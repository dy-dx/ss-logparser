var cfg = {
  // UDP server port
  port: process.env.PORT || 8006
  // Stats Update Rate, in milliseconds
, stats_update_rate: 1500
  // Redis Info
, redis_host: process.env.REDIS_HOST || '127.0.0.1'
, redis_port: parseInt(process.env.REDIS_PORT, 10) || 8005
, redis_db: parseInt(process.env.REDIS_DB, 10) || 0
, redis_password: process.env.REDIS_PASSWORD

// foreman options
, verbose: true
// , verbose: false
, ss_address: 'http://localhost:8001'
// , ss_address: 'http://sizzlingstats.com:8011'
// , ss_address: 'http://localhost:8011'

// BRPOP timeout in seconds
, loghandler_timeout: 120
// , loghandler_timeout: 15

, parser_options: {
  //   debug: true
  // , verbose: true
  }
};

module.exports = cfg;
