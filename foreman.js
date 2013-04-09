var redis = require('redis')
  // , util = require('util')
  , request = require('request')
  , npid = require('./lib/pid')
  , parser = require('./lib/parser')
  , cfg = require('./cfg/cfg')
  , ss_address = cfg.ss_address
  , verbose = cfg.verbose;
var subscriberClient = redis.createClient(8005);

// Create a pidfile with the worker's ID and pid
try {
  npid.create(__dirname + '/worker-' + process.pid + '.pid', true);
} catch (err) {
  console.log(err);
  process.exit(1);
}

process.on('SIGTERM', exit);
process.on('SIGINT', exit);
// process.on('SIGKILL', exit); // This breaks in node v0.10.x

// This is for removing the pidfile when nodemon restarts due to changes
process.once('SIGUSR2', function() {
  npid.remove(__dirname + '/worker-' + process.pid + '.pid');
  process.nextTick(function() {
    process.kill(process.pid, 'SIGUSR2');
  });
});

function exit (code) {
  process.nextTick(function() {
    process.exit(code || 0);
  });
}


function LogStreamHandler (tf2server, redisClient) {
  this.tf2server = tf2server;
  this.redisClient = redisClient;
  this.parser = new parser(cfg.parser_options);
  this.requestIsInProgress = false;
  this.updateTimer = 0;

  this.setupListeners();
}

LogStreamHandler.prototype.setupListeners = function () {
  var self = this;

  this.parser.on('got sessionid', function (sessionId) {
    self.sessionId = sessionId;
    self.getMatchId(sessionId, function (err, matchId) {
      if (err) {return console.trace(err);}
      verbose && console.log('got matchId', matchId);
      self.matchId = matchId;
      self.startStreamingStats();
    });
  });

  this.parser.on('round end', function (stats) {
    // Check for matchId
    var matchId = self.matchId;
    if (!matchId) {
      verbose && console.log('aborting round-end-update, no matchId');
      return false;
    }

    verbose && console.log('round ended');
    self.requestIsInProgress = true;

    request.post({uri: ss_address + '/api/log/stats/roundover'
                , json: {stats: stats}
                , headers: {sessionid: self.sessionId}
                , timeout: 3000
                }, function (err, res, body) {
      self.requestIsInProgress = false;
      if (err) {
        return console.log(err);
      }
      if (res.statusCode > 202) {
        console.log(new Error('API Error: ' + res.statusCode));
      }

      verbose && console.log(res.body);
    });
  });


  this.parser.on('match end', function (chats, matchDuration) {
    // verbose && console.log('match ended:', matchDuration);

    // request.post({uri: ss_address + '/api/log/stats/gameover'
    //             , json: {chats: chats}
    //             , headers: {sessionid: self.sessionId, matchduration: matchDuration}
    //             , timeout: 3000
    //             }, function (err, res, body) {
    //   // Error checking
    //   if (err) {
    //     console.log(err);
    //   }
    //   if (res.statusCode > 202) {
    //     console.log(new Error('API Error: ' + res.statusCode));
    //   }

    //   verbose && console.log(res.body);
    //   self.sessionid = null;
    // });
    self.stopStreamingStats();
  });
};

LogStreamHandler.prototype.sendStatsUpdate = function (stats) {
  var self = this;
  // Check for matchId
  var matchId = self.matchId;
  if (!matchId) {
    verbose && console.log('aborting stats update, no matchId');
    return false;
  }

  if (self.requestIsInProgress) {
    verbose && console.log('aborting stats update, request is in progress');
    return false;
  }

  self.requestIsInProgress = true;

  stats._id = matchId;

  request.post({uri: ss_address + '/api/log/stats/update'
              , json: {stats: stats}
              , timeout: 3000
              }, function (err, res, body) {
    self.requestIsInProgress = false;
    if (err) {
      return console.log(err);
    }
    if (res.statusCode > 202) {
      console.log(new Error('API Error: ' + res.statusCode));
    }

    verbose && console.log(res.body);
  });
};

LogStreamHandler.prototype.startStreamingStats = function () {
  var self = this;
  self.updateTimer = setInterval(function () {
    self.sendStatsUpdate(self.parser.trustedFormattedStats());
  }, cfg.stats_update_rate);
};

LogStreamHandler.prototype.stopStreamingStats = function () {
  clearTimeout(this.updateTimer);
  this.updateTimer = 0;
};

LogStreamHandler.prototype.getMatchId = function (sessionId, cb) {
  var self = this;
  self.requestIsInProgress = true;

  request.post({uri: ss_address + '/api/log/matchid'
              , headers: {sessionid: sessionId}
              , timeout: 3000
              }, function (err, res, body) {
    self.requestIsInProgress = false;

    if (err) {return cb(err);}
    if (res.statusCode !== 200) {
      return cb(new Error('Error checking sessionid: ' + res.statusCode + ' ' + body));
    }

    cb(null, parseInt(res.headers.matchid, 10));
  });
};

LogStreamHandler.prototype.destroy = function () {
  var self = this;
  var redisCounterKey = 'counter:' + self.tf2server;

  self.stopStreamingStats();

  self.redisClient.multi()
    .del(redisCounterKey)
    .del(self.tf2server)
    .exec(function (err, replies) {
      if (err) {console.trace(err);}
      self.redisClient.quit(function (err) {
        if (err) {console.trace(err);}
        delete redisClients[self.tf2server];
        delete logStreamHandlers[self.tf2server];
        verbose && console.log(Object.keys(logStreamHandlers).length, 'logstream handlers remaining.');
        verbose && console.log(Object.keys(redisClients).length, 'redis clients remaining.');
      });
    });
};


var logStreamHandlers = {};
var redisClients = {};

// param `channel` is 'logmessage'
subscriberClient.on('message', function (channel, tf2server) {
  var logStreamHandler = logStreamHandlers[tf2server];
  var client = redisClients[tf2server];

  if (!client) {
    client = redisClients[tf2server] = redis.createClient(cfg.redis_port, cfg.redis_host);
  }
  if (!logStreamHandler) {
    logStreamHandler = logStreamHandlers[tf2server] = new LogStreamHandler(tf2server, client);
    console.log('Creating new parser for list', tf2server);
  }

  var readMessage = function () {
    client.brpop(tf2server, cfg.loghandler_timeout, function (err, messageBuffer) {
      if (err) {return console.log(err);}
      if (!messageBuffer) {
        // Timeout expired, so handle that
        verbose && console.log('Listener for', tf2server, 'timed out.');
        return logStreamHandler.destroy();
      }
      if (!messageBuffer.length || messageBuffer.length < 2) {
        return console.log('length < 2???', messageBuffer);
      }
      message = messageBuffer[1].toString('ascii').slice(5,-2);
      logStreamHandler.parser.parse(message);

      process.nextTick(readMessage);
    });
  };
  readMessage();

});

subscriberClient.subscribe('logmessage');
