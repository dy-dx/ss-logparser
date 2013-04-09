var fs = require('fs')
  , dgram = require('dgram')
  , request = require('request')
  , cfg = require('./cfg/cfg')
  , redis = require('redis');

var ssAddress = 'http://localhost:8001'
  , clientAddress = '127.0.0.1'
  , serverPort = cfg.port;

// Time, in milliseconds, to wait before sending the next line
var lineSendInterval = 15;


// Log constructor
function Log (logPath, clientAddress, clientUdpPort, remoteUdpPort, interval) {
  var self = this;
  this.logPath = logPath;
  var data = fs.readFileSync(this.logPath, 'ascii');
  this.lines = data.split('\n');
  this.length = this.lines.length;

  // Defaults
  this.clientAddress = clientAddress || '127.0.0.1';
  this.clientUdpPort = clientUdpPort || 8002;
  this.remoteUdpPort = remoteUdpPort || 8006;

  // Redis keys
  this.redisListKey = 'sslog:' + this.clientAddress + ':' + this.clientUdpPort;
  this.redisCounterKey = 'counter:' + this.redisListKey;

  // Get a new sessionId
  this.getSessionId(function (err, sessionId) {
    if (err) {return console.log(err);}
    self.sessionId = sessionId;
    self.sendLines(interval);
  });
}

Log.prototype.sendLines = function (interval) {
  interval = interval || 15;
  var self = this;
  console.log('Sending', self.length, 'lines to', self.redisListKey + '...');

  var delayedLoop = function (i) {
    if (i < self.length) {
      setTimeout(function () {
        // TODO: callback
        self.sendLine(i);
        delayedLoop(++i);
      }, interval);
    } else {
      setTimeout(function () {
        console.log('Finished reading from', self.logPath, 'to', self.redisListKey);
        self.checkRedis();
      }, 1500);
    }
  };

  delayedLoop(0); // Start reading from first line
  // delayedLoop(4000);
};

Log.prototype.sendLine = function (i) {
  var self = this;
  var line = self.lines[i];

  // Check for sessionid, inject new one
  var suffix = line.substring(25);
  var regex = /^\[SizzlingStats\]: sessionid (.*)$/;
  var captured = suffix.match(regex);
  if (captured) {
    // Replace with new
    suffix = '[SizzlingStats]: sessionid ' + self.sessionId;
    var prefix = line.substring(0,25);
    line = prefix.concat(suffix);
  }

  line = this.addPaddingAndConvertToBuffer(line);

  var client = dgram.createSocket('udp4');
  client.bind(self.clientUdpPort, '0.0.0.0', function () {
    client.send(line, 0, line.length, self.remoteUdpPort, '0.0.0.0', function (err, bytes) {
      if (err) {console.log(err);}
      client.close();
    });
  });
};

Log.prototype.addPaddingAndConvertToBuffer = function (line) {
  // Add weird padding because the world is not fair
  line = '����R' + line;
  // More weird padding, because the world is not fair
  if (line[line.length-1] == '\r') {
    line = line.slice(0,-1);
  }
  line += '\n\u0000';

  // Convert back to a buffer, because again, the world is not fair
  return new Buffer(line, 'ascii');
};


Log.prototype.checkRedis = function () {
  var self = this;
  var lines = this.lines
    , redisListKey = this.redisListKey
    , redisCounterKey = this.redisCounterKey
    , redisClient = redis.createClient(cfg.redis_port, cfg.redis_host);

  // Check if number of lines counted in redis == lines.length,
  //  which signifies that each message made it into redis
  redisClient.get(redisCounterKey, function (err, result) {
    if (err) {return console.log(err);}
    var count = parseInt(result, 10);
    if (count !== lines.length) {
      console.log('Ya blew it,', count, 'lines were inserted into', redisListKey
                , 'instead of', lines.length);
    }
    redisClient.del(redisCounterKey, function (err, result) {
      if (err) { console.log(err); /*do something*/}

      redisClient.llen(redisListKey, function (err, length) {
        if (err) { console.log(err); /*do something*/}
        // If the list is empty, just quit
        if (length === 0) {
          console.log(redisListKey, 'cleared from redis.');
          return redisClient.quit();
        }
        // The list still has elements in it, so notify
        console.log('Yo you got some stuff left in that list.');
        redisClient.lrange(redisListKey, 0, -1, function (err, result) {
          if (err) { console.log(err); /*do something*/}
          console.log(result);
          redisClient.quit();
        });
      });
    });
  });
};


// just for mocking. send a dummy stats doc to the ss api in order to get
//  a valid sessionid.
Log.prototype.getSessionId = function (cb) {
  var mockStats = {
    redscore: 0
  , bluscore: 0
  , teamfirstcap: 0
  , roundduration: 0
  , players: ['foobar']
  , map: 'cp_foobar'
  , hostname: this.logPath
  // , hostname: 'foo bar'
  , redname: 'RED'
  , bluname: 'BLU'
  };

  request.post({uri: ssAddress + '/api/stats/new'
              , json: {stats: mockStats}
              , headers: {sizzlingstats: "v0.1"}
              , timeout: 3000
              }, function (err, res, body) {
    if (err) {
      return cb(err);
    }
    if (res.statusCode > 202) {
      return cb(new Error('Error getting new sessionid: ' + res.statusCode));
    }

    console.log('got sessionid', res.headers.sessionid);

    cb(null, res.headers.sessionid);

  });
};


// var LogA = new Log('./mockdata/log_17211.log', clientAddress, 8002, serverPort);
// var LogB = new Log('./mockdata/log_17215.log', clientAddress, 8003, serverPort);
// var LogC = new Log('./mockdata/walterwhite.log', clientAddress, 8004, serverPort, 10);

// 8ms interval
var LogD = new Log('./mockdata/jay0912.log', clientAddress, 8005, serverPort, 8);
