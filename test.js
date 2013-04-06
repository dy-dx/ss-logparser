var fs = require('fs')
  , dgram = require('dgram')
  , cfg = require('./cfg/cfg')
  , redis = require('redis');

var clientAddress = '127.0.0.1'
  // , clientPort = 8002
  , serverPort = cfg.port;
  // , redisListKey = 'sslog:' + clientAddress + ':' + clientPort
  // , redisCounterKey = 'counter:' + redisListKey;

// TODO: test using multiple logfiles at the same time, async

// var initialLineParseRate = 6; // initial
// var lineParseRate = 40; //ms
// var secondLineParseRate = 100;
// var secondLineParseRate = 350;

// var lineParseRate = initialLineParseRate;
var lineParseRate = 15;

var checkRedis = function(self) {
  var lines = self.lines
    , redisListKey = self.redisListKey
    , redisCounterKey = self.redisCounterKey
    , redisClient = redis.createClient(cfg.redis_port, cfg.redis_host);

  // Check if number of lines counted in redis == lines.length
  redisClient.get(redisCounterKey, function (err, result) {
    if (err) {return console.log(err);}
    var count = parseInt(result, 10);
    if (count !== lines.length) {
      console.log('Ya blew it,', count, 'lines were inserted into', redisListKey
                , 'instead of', lines.length);
    }
    redisClient.del(redisCounterKey, function (err, result) {
      // whatever

      redisClient.llen(redisListKey, function (err, length) {
        if (length !== 0) {
          console.log('Yo you got some stuff left in that list.');
          redisClient.lrange(redisListKey, 0, -1, function (err, result) {
            console.log(result);
            redisClient.quit();
          });
        } else {
          console.log(redisListKey, 'is done.');
          // redisClient.quit();
        }
      });
    });
  });
};

var sendLines = function (data, clientPort) {
  var self = this;
  var lines = this.lines = data.split('\n')
    , length = this.length = lines.length
    , redisListKey = this.redisListKey = 'sslog:' + clientAddress + ':' + clientPort
    , redisCounterKey = this.redisCounterKey = 'counter:' + redisListKey;
  var i = 0;

  sendLine = function () {
    var message = lines[i];
    // Add padding because the world is not fair
    message = '     ' + message;
    if (message[message.length-1] !== '\r') {
      // add a CLRF if needed because the world is not fair
      message += '\r';
    }

    // Convert back to a buffer, because again, the world is not fair
    message = new Buffer(message, 'ascii');

    var client = dgram.createSocket('udp4');
    client.bind(clientPort, '0.0.0.0', function () {
      client.send(message, 0, message.length, serverPort, '0.0.0.0', function (err, bytes) {
        if (err) {console.log(err);}
        client.close();
      });
    });

    ++i;
    if (i < length) {
      setTimeout(sendLine, lineParseRate);
    } else {
      setTimeout(function () {
        console.log('done.');
        checkRedis(self);
      }, 1000);
    }
  };

  console.log('Sending', lines.length, 'lines to', redisListKey + '...');

  sendLine();
  // })(4000, lines.length);
};

sendLines('String 1', 8002);
sendLines('String 2', 8003);
// sendLines(data3, 8004);
