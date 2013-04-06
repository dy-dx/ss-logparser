// Generated by CoffeeScript 1.6.2
(function() {
  var EventEmitter, Match, Player, debuggingRegexTests, handlers, regexTests, util, _,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  util = require('util');

  _ = require('underscore');

  EventEmitter = require('events').EventEmitter;

  Player = (function() {
    function Player(name, userId, steamId, team, match) {
      this.name = name;
      this.userId = userId;
      this.steamId = steamId;
      this.team = team;
      this.stats = {};
      this.classStats = {};
      this.isConnected = true;
      this.getMatch = function() {
        return match;
      };
      if (this.isPlaying) {
        this.resetStats();
      }
    }

    Player.prototype.resetStats = function() {
      this.stats = {
        kills: 0,
        killassists: 0,
        medpicks: 0,
        damagedone: 0,
        deaths: 0,
        suicides: 0,
        captures: 0,
        defenses: 0,
        dominations: 0,
        revenge: 0,
        headshots: 0,
        backstabs: 0,
        invulns: 0,
        ubersdropped: 0,
        healpoints: 0,
        healsreceived: 0,
        buildingsbuilt: 0,
        buildingsdestroyed: 0
      };
      return this.classStats = {};
    };

    Player.prototype.isPlaying = function() {
      return this.isConnected && (this.team === 'Blue' || this.team === 'Red');
    };

    Player.prototype.isNotSourceTV = function() {
      return !(this.steamId === 'BOT' && this.team === 'Spectator');
    };

    Player.prototype.setDisconnected = function() {
      if (this.isLive) {
        this.isConnected = false;
        return this.stopTrackingStats(true);
      } else {
        return this.deleteFromMatch();
      }
    };

    Player.prototype.setTeam = function(newTeam) {
      if (newTeam !== 'Red' && newTeam !== 'Blue') {
        this.stopTrackingStats(true);
      } else if (!this.currentClass && this.lastClass) {
        this.setClass(this.lastClass);
      }
      return this.team = newTeam;
    };

    Player.prototype.setClass = function(newClass) {
      if (newClass && this.currentClass) {
        this.saveTimeSpentPlayingClass();
        if (Object.keys(this.classStats).length === 0 && this.isLive) {
          this.resetStats();
        }
      }
      this.timeOfLastClassSwitch = this.getMatch().currentTime;
      if (this.currentClass) {
        this.lastClass = this.currentClass;
      }
      return this.currentClass = newClass;
    };

    Player.prototype.setName = function(name) {
      this.name = name;
    };

    Player.prototype.startTrackingStats = function() {
      if (this.isPlaying()) {
        return this.setClass(this.currentClass);
      }
    };

    Player.prototype.stopTrackingStats = function(unsetCurrentClass) {
      this.saveTimeSpentPlayingClass();
      if (unsetCurrentClass) {
        return this.setClass(null);
      }
    };

    Player.prototype.saveTimeSpentPlayingClass = function() {
      var timePlayed, _base, _name, _ref;

      if (!(this.getMatch().isInPlay && this.currentClass)) {
        return false;
      }
      if ((_ref = (_base = this.classStats)[_name = this.currentClass]) == null) {
        _base[_name] = {
          timePlayed: 0
        };
      }
      if (this.timeOfLastClassSwitch) {
        timePlayed = this.getMatch().currentTime - this.timeOfLastClassSwitch;
        if (timePlayed > 5000) {
          return this.classStats[this.currentClass].timePlayed += timePlayed;
        }
      }
    };

    Player.prototype.addToStat = function(stat, value) {
      var _base, _ref;

      if (!this.getMatch().isInPlay) {
        return;
      }
      if ((_ref = (_base = this.stats)[stat]) == null) {
        _base[stat] = 0;
      }
      return this.stats[stat] += value;
    };

    Player.prototype.incrementStat = function(stat) {
      var _base, _ref;

      if (!this.getMatch().isInPlay) {
        return;
      }
      if ((_ref = (_base = this.stats)[stat]) == null) {
        _base[stat] = 0;
      }
      return this.stats[stat]++;
    };

    Player.prototype.decrementStat = function(stat) {
      var _base, _ref;

      if (!this.getMatch().isInPlay) {
        return;
      }
      if ((_ref = (_base = this.stats)[stat]) == null) {
        _base[stat] = 0;
      }
      return this.stats[stat]--;
    };

    Player.prototype.deleteFromMatch = function() {
      var identifier;

      identifier = this.steamId !== 'BOT' ? this.steamId : this.userId;
      return delete this.getMatch().players[identifier];
    };

    Player.prototype.getPlayedClasses = function(obfuscateClassIds) {
      var bitfield, className, classStat, _ref;

      bitfield = 0;
      _ref = this.classStats;
      for (className in _ref) {
        classStat = _ref[className];
        if (classStat.timePlayed) {
          bitfield |= 1 << (this.classNameToId(className, obfuscateClassIds) - 1);
        }
      }
      if (!bitfield && this.currentClass) {
        bitfield |= 1 << (this.classNameToId(this.currentClass, obfuscateClassIds) - 1);
      }
      return bitfield;
    };

    Player.prototype.getMostPlayedClass = function(obfuscateClassIds) {
      var className, classStat, maxTime, mostPlayedClass, _ref;

      maxTime = 0;
      _ref = this.classStats;
      for (className in _ref) {
        classStat = _ref[className];
        if (classStat.timePlayed > maxTime) {
          maxTime = classStat.timePlayed;
          mostPlayedClass = this.classNameToId(className, obfuscateClassIds);
        }
      }
      return mostPlayedClass || this.classNameToId(this.currentClass, obfuscateClassIds);
    };

    Player.prototype.classNameToId = function(className, obfuscateClassIds) {
      if (obfuscateClassIds) {
        return {
          0: 0,
          scout: 1,
          soldier: 3,
          pyro: 7,
          demoman: 4,
          heavyweapons: 6,
          engineer: 9,
          medic: 5,
          sniper: 2,
          spy: 8
        }[className];
      }
      return {
        0: 0,
        scout: 1,
        soldier: 2,
        pyro: 3,
        demoman: 4,
        heavyweapons: 5,
        engineer: 6,
        medic: 7,
        sniper: 8,
        spy: 9
      }[className];
    };

    Player.prototype.teamNameToId = function(teamName) {
      return {
        Spectator: 1,
        Red: 2,
        Blue: 3
      }[teamName];
    };

    Player.prototype.formattedStats = function(obfuscateClassIds) {
      var formattedStats;

      formattedStats = _.clone(this.stats);
      formattedStats.name = this.name;
      formattedStats.steamid = this.steamId;
      formattedStats.team = this.teamNameToId(this.team);
      formattedStats.mostplayedclass = this.getMostPlayedClass(obfuscateClassIds);
      formattedStats.playedclasses = this.getPlayedClasses(obfuscateClassIds);
      return formattedStats;
    };

    return Player;

  })();

  Match = (function(_super) {
    __extends(Match, _super);

    function Match(options) {
      if (options == null) {
        options = {};
      }
      this.verbose = options.verbose;
      this.debug = options.debug;
      this.initialize();
      if (this.debug) {
        this.regexTests = regexTests.concat(debuggingRegexTests);
      } else {
        this.regexTests = regexTests;
      }
    }

    Match.prototype.initialize = function() {
      this.isLive = false;
      this.isInPlay = false;
      this.players = {};
      return this.chats = [];
    };

    Match.prototype.resetScore = function() {
      this.redLastScore = 0;
      this.redCurrentScore = 0;
      this.redRoundsWon = 0;
      this.bluLastScore = 0;
      this.bluCurrentScore = 0;
      return this.bluRoundsWon = 0;
    };

    Match.prototype.startMatch = function() {
      this.isLive = true;
      this.currentRound = 0;
      this.resetScore();
      this.startTime = this.currentTime;
      return this.verbose && console.log('*** Starting match at', this.startTime);
    };

    Match.prototype.startRound = function() {
      var id, player, _ref;

      this.roundStartTime = this.currentTime;
      this.teamfirstcap = 0;
      if (this.isLive) {
        this.currentRound++;
      } else {
        this.startMatch();
      }
      _ref = this.players;
      for (id in _ref) {
        player = _ref[id];
        if (!(player.isNotSourceTV())) {
          continue;
        }
        player.resetStats();
        player.startTrackingStats();
      }
      this.isInPlay = true;
      return this.verbose && console.log('* Starting round', this.currentRound);
    };

    Match.prototype.endRound = function(team) {
      var id, player, _ref;

      this.verbose && console.log("* " + team + " won round " + this.currentRound + ".");
      _ref = this.players;
      for (id in _ref) {
        player = _ref[id];
        player.stopTrackingStats();
      }
      this.isInPlay = false;
      if (team === 'Red') {
        return this.redRoundsWon++;
      } else if (team === 'Blue') {
        return this.bluRoundsWon++;
      }
    };

    Match.prototype.endMatch = function() {
      if (!this.isLive) {
        return;
      }
      this.isLive = false;
      this.isInPlay = false;
      this.emit('match end', this.chats, (this.currentTime - this.startTime) / 1000);
      this.verbose && console.log("*** Game Over.");
      return this.initialize();
    };

    Match.prototype.setTeamScore = function(team, score) {
      if (team === 'Red') {
        this.redLastScore = this.redCurrentScore;
        this.redCurrentScore = score;
      } else if (team === 'Blue') {
        this.bluLastScore = this.bluCurrentScore;
        this.bluCurrentScore = score;
      }
      if (this.numberOfTimesThisThingWasCalled) {
        this.numberOfTimesThisThingWasCalled = 0;
        this.emit('round end', this.formattedStats(false, true));
        this.bluLastScore = this.bluCurrentScore;
        this.redLastScore = this.redCurrentScore;
        return this.chats = [];
      } else {
        return this.numberOfTimesThisThingWasCalled = 1;
      }
    };

    Match.prototype.setCurrentTime = function(currentTime) {
      this.currentTime = currentTime;
    };

    Match.prototype.formattedStats = function(isMatchStart, sendChats) {
      var id, player, stats, _ref;

      stats = {
        bluscore: this.bluCurrentScore - this.bluLastScore,
        redscore: this.redCurrentScore - this.redLastScore,
        teamfirstcap: this.teamfirstcap,
        roundduration: (this.currentTime - this.roundStartTime) / 1000,
        players: []
      };
      if (isMatchStart) {
        stats.map = this.map || 'cp_whatever';
        stats.hostname = 'test server';
        stats.bluname = 'BLU';
        stats.redname = 'RED';
      }
      if (sendChats) {
        stats.chats = this.chats;
      }
      _ref = this.players;
      for (id in _ref) {
        player = _ref[id];
        stats.players.push(player.formattedStats(true));
      }
      return stats;
    };

    Match.prototype.trustedFormattedStats = function() {
      var id, player, stats, _ref;

      stats = {
        bluscore: this.bluCurrentScore - this.bluLastScore,
        redscore: this.redCurrentScore - this.redLastScore,
        teamfirstcap: this.teamfirstcap,
        roundduration: (this.currentTime - this.roundStartTime) / 1000,
        players: {}
      };
      _ref = this.players;
      for (id in _ref) {
        player = _ref[id];
        stats.players[id] = player.formattedStats(false);
      }
      return stats;
    };

    Match.prototype.getOrInsertPlayer = function(ignore, name, userId, steamId, team) {
      var identifier;

      identifier = steamId !== 'BOT' ? steamId : userId;
      if (this.players[identifier]) {
        return this.players[identifier];
      }
      return this.players[identifier] = new Player(name, userId, steamId, team, this);
    };

    Match.prototype.parse = function(line) {
      var originalLine, self;

      if (!line) {
        return;
      }
      self = this;
      if (line.substring(0, 2) !== 'L ' || !(line.length > 25)) {
        return console.log('malformed', line);
      }
      originalLine = line;
      line = line.substring(2);
      this.setCurrentTime(new Date(parseInt(line.substring(6, 10), 10), (parseInt(line.substring(0, 2), 10)) - 1, parseInt(line.substring(3, 5), 10), parseInt(line.substring(13, 15), 10), parseInt(line.substring(16, 18), 10), parseInt(line.substring(19, 21), 10)));
      line = line.substring(23);
      if (this.ignoreLog) {
        if (/^server cvars end$/.test(line)) {
          this.ignoreLog = false;
        }
        return;
      }
      return this.runTests(line, this.regexTests, function(matchingTests) {
        if (self.debug && matchingTests.length !== 1) {
          console.log('Problem with line', originalLine);
          if (matchingTests.length === 0) {
            return console.log('not found');
          } else if (matchingTests.length > 1) {
            return console.log('more than 1 test matched', matchingTests);
          }
        }
      });
    };

    Match.prototype.parsePlayer = function(playerString, cb) {
      var info, regex;

      regex = /^((?:(?!STEAM).){1,32})<(\d+)><(BOT|STEAM_\d:[0-1]:\d{1,10})><(Blue|Red|Spectator|Unassigned)?>$/;
      info = playerString.match(regex);
      if (!info) {
        return cb('ERROR with playerString: ' + playerString);
      }
      return cb(null, this.getOrInsertPlayer.apply(this, info));
    };

    Match.prototype.runTests = function(line, regexTests, cb) {
      var captured, description, handler, matchingTests, regex, regexTest, _i, _len;

      matchingTests = [];
      for (_i = 0, _len = regexTests.length; _i < _len; _i++) {
        regexTest = regexTests[_i];
        description = regexTest[0], handler = regexTest[1], regex = regexTest[2];
        captured = line.match(regex);
        if (captured) {
          if (handler) {
            handlers[handler].apply(this, captured);
          }
          if (this.debug) {
            matchingTests.push(description);
          } else {
            break;
          }
        }
      }
      return cb(matchingTests);
    };

    Match.prototype.shutdown = function(line) {};

    return Match;

  })(EventEmitter);

  module.exports = Match;

  handlers = {
    loadingMap: function(line, map) {
      this.setIgnoreLog(true);
      this.initialize();
      return this.setMap(map);
    },
    roundStart: function() {
      return this.startRound();
    },
    roundWin: function(line, team) {
      return this.endRound(team);
    },
    roundStalemate: function(line) {
      return this.endRound();
    },
    gameOver: function(line) {
      return this.endMatch();
    },
    playerJoinedTeam: function(line, playerString, team) {
      return this.parsePlayer(playerString, function(err, player) {
        if (err) {
          return console.log(err);
        }
        return player.setTeam(team);
      });
    },
    playerChangedClass: function(line, playerString, newClass) {
      return this.parsePlayer(playerString, function(err, player) {
        if (err) {
          return console.log(err);
        }
        return player.setClass(newClass);
      });
    },
    playerChangedName: function(line, playerString, newName) {
      return this.parsePlayer(playerString, function(err, player) {
        if (err) {
          return console.log(err);
        }
        return player.setName(newName);
      });
    },
    playerDisconnected: function(line, playerString, reason) {
      return this.parsePlayer(playerString, function(err, player) {
        if (err) {
          return console.log(err);
        }
        return player.setDisconnected();
      });
    },
    playerSaid: function(line, playerString, type, body) {
      return this.parsePlayer(playerString, function(err, player) {
        if (err) {
          return console.log(err);
        }
        if (!this.isLive) {
          return;
        }
        return this.chats.push({
          steamid: player.steamId,
          isTeam: type === 'say_team',
          time: (this.currentTime - this.startTime) / 1000,
          message: body
        });
      });
    },
    playerKilled: function(line, playerString, victimString, weapon, customkill) {
      var self;

      self = this;
      return self.parsePlayer(playerString, function(err, player) {
        if (err) {
          return console.log(err);
        }
        if (customkill) {
          if (customkill === 'feign_death') {
            return;
          }
          player.incrementStat(customkill + 's');
        }
        player.incrementStat('kills');
        return self.parsePlayer(victimString, function(err, victim) {
          if (err) {
            return console.log(err);
          }
          return victim.incrementStat('deaths');
        });
      });
    },
    playerAssisted: function(line, playerString) {
      return this.parsePlayer(playerString, function(err, player) {
        if (err) {
          return console.log(err);
        }
        return player.incrementStat('killassists');
      });
    },
    playerDealtDamage: function(line, playerString, damage) {
      return this.parsePlayer(playerString, function(err, player) {
        if (err) {
          return console.log(err);
        }
        return player.addToStat('damagedone', parseInt(damage, 10));
      });
    },
    playerUbered: function(line, playerString) {
      return this.parsePlayer(playerString, function(err, player) {
        if (err) {
          return console.log(err);
        }
        return player.incrementStat('invulns');
      });
    },
    playerBuiltBuilding: function(line, playerString) {
      return this.parsePlayer(playerString, function(err, player) {
        if (err) {
          return console.log(err);
        }
        return player.incrementStat('buildingsbuilt');
      });
    },
    playerDestroyedBuilding: function(line, playerString) {
      return this.parsePlayer(playerString, function(err, player) {
        if (err) {
          return console.log(err);
        }
        return player.incrementStat('buildingsdestroyed');
      });
    },
    playerHealed: function(line, playerString, victimString, value) {
      this.parsePlayer(playerString, function(err, player) {
        if (err) {
          return console.log(err);
        }
        return player.addToStat('healpoints', parseInt(value, 10));
      });
      return this.parsePlayer(victimString, function(err, victim) {
        if (err) {
          return console.log(err);
        }
        return victim.addToStat('healsreceived', parseInt(value, 10));
      });
    },
    playerExtinguished: function(line, playerString) {
      return this.parsePlayer(playerString, function(err, player) {
        if (err) {
          return console.log(err);
        }
        return player.incrementStat('extinguishes');
      });
    },
    playerKilledMedic: function(line, playerString, victimString, medicDropped) {
      this.parsePlayer(playerString, function(err, player) {
        if (err) {
          return console.log(err);
        }
        return player.incrementStat('medpicks');
      });
      if (parseInt(medicDropped, 10)) {
        return this.parsePlayer(victimString, function(err, victim) {
          if (err) {
            return console.log(err);
          }
          return victim.incrementStat('ubersdropped');
        });
      }
    },
    playerCommittedSuicide: function(line, playerString) {
      return this.parsePlayer(playerString, function(err, player) {
        if (err) {
          return console.log(err);
        }
        player.incrementStat('suicides');
        return player.incrementStat('deaths');
      });
    },
    playerDominationOrRevenge: function(line, playerString, type, victimString) {
      if (type === 'domination') {
        type += 's';
      }
      return this.parsePlayer(playerString, function(err, player) {
        if (err) {
          return console.log(err);
        }
        return player.incrementStat(type);
      });
    },
    playerDefended: function(line, playerString) {
      return this.parsePlayer(playerString, function(err, player) {
        if (err) {
          return console.log(err);
        }
        return player.incrementStat('defenses');
      });
    },
    teamCurrentScore: function(line, team, score) {
      return this.setTeamScore(team, parseInt(score, 10));
    },
    teamCapturedPoint: function(line, team, cp, numCappers, restOfLine) {
      var capper, cappers, i, regexString, _i, _j, _len, _results;

      if (!this.teamfirstcap) {
        this.teamfirstcap = {
          Red: 2,
          Blue: 3
        }[team];
      }
      numCappers = parseInt(numCappers, 10);
      regexString = '^';
      for (i = _i = 0; _i < numCappers; i = _i += 1) {
        regexString += ' \\(player\\d+ "(.*<\\d+><.+><(?:Red|Blue)>)"\\)' + ' \\(position\\d+ ".*"\\)';
      }
      regexString += '$';
      cappers = restOfLine.match(new RegExp(regexString)).slice(1);
      if (!cappers) {
        return false;
      }
      _results = [];
      for (_j = 0, _len = cappers.length; _j < _len; _j++) {
        capper = cappers[_j];
        _results.push(this.parsePlayer(capper, function(err, player) {
          if (err) {
            return console.log(err);
          }
          return player.incrementStat('captures');
        }));
      }
      return _results;
    },
    sizzlingPlayerRole: function(line, name, userId, steamId, team, role) {
      var player;

      player = this.getOrInsertPlayer(null, name, userId, steamId, team);
      if (role === 'undefined') {
        role = null;
      }
      return player.setClass(role);
    },
    sizzlingSessionId: function(line, sessionId) {
      return this.emit('got sessionid', sessionId);
    }
  };

  regexTests = [['SizzlingStats: Match Started', 'roundStart', /^\[SizzlingStats\]: Match Started$/], ['SizzlingStats: player is role', 'sizzlingPlayerRole', /^\[SizzlingStats\]: player "(.{1,32})"<(.+)><(.+)><(.+)> is role (\w+)$/], ['SizzlingStats: sessionid', 'sizzlingSessionId', /^\[SizzlingStats\]: sessionid (.*)$/], ['Team current score', 'teamCurrentScore', /^Team "(Red|Blue)" current score "(\d+)" with "\d+\" players$/], ['World triggered: Round_Start', 'roundStart', /^World triggered "Round_Start"$/], ['World triggered: Round_Win', 'roundWin', /^World triggered "Round_Win" \(winner "(Blue|Red)"\)$/], ['World triggered: Round_Stalemate', 'roundStalemate', /^World triggered "Round_Stalemate"$/], ['World triggered: Game_Over', 'gameOver', /^World triggered "Game_Over" reason ".*"$/], ['team triggered: Intermission_Win_Limit', 'gameOver', /^Team "(?:RED|BLUE)" triggered "Intermission_Win_Limit"$/], ['player joined a team', 'playerJoinedTeam', /^"(.{1,32}<\d+><.+><(?:Red|Blue|Spectator|Unassigned)>)" joined team "(Red|Blue|Spectator)"$/], ['player changed class', 'playerChangedClass', /^"(.{1,32}<\d+><.+><(?:Red|Blue)>)" changed role to "([a-z]+)"$/], ['player changed name', 'playerChangedName', /^"(.{1,32}<\d+><.+><(?:Red|Blue|Spectator)>)" changed name to "(.+)"$/], ['player disconnected', 'playerDisconnected', /^"(.{0,32}<\d+><(?:BOT|STEAM_[\d:]{5,14})><(?:Red|Blue|Spectator)?>)"\x20disconnected\x20\(reason\x20"(.*)"\)$/], ['team triggered: pointcaptured', 'teamCapturedPoint', /^Team\x20"(Red|Blue)"\x20triggered\x20"pointcaptured"\x20\(cp\x20"(\d+)"\)\x20\(cpname\x20".*"\)\x20\(numcappers\x20"(\d+)"\)(.*)\x20$/], ['player triggered: playerDamage', 'playerDealtDamage', /^"(.{1,32}<\d+><.+><(?:Red|Blue)>)" triggered "damage" \(damage "(\d+)"\)$/], ['player triggered: chargedeployed', 'playerUbered', /^"(.{1,32}<\d+><.+><(?:Red|Blue)>)" triggered "chargedeployed"$/], ['player triggered: heal', 'playerHealed', /^"(.{1,32}<\d+><.+><(?:Red|Blue)>)"\x20triggered\x20"healed"\x20against\x20"(.{1,32}<\d+><.+><(?:Red|Blue)>)"\x20\(healing\x20"(\d+)"\)$/], ['player triggered: medic_death', 'playerKilledMedic', /^"(.{1,32}<\d+><.+><(?:Red|Blue)>)"\x20triggered\x20"medic_death"\x20against\x20"(.{1,32}<\d+><.+><(?:Red|Blue)>)"\x20\(healing\x20"\d+"\)\x20\(ubercharge\x20"([0-1])"\)$/], ['player triggered: kill assist', 'playerAssisted', /^"(.{1,32}<\d+><.+><(?:Red|Blue)>)"\x20triggered\x20"kill\x20assist"\x20against\x20"(.{1,32}<\d+><.+><(?:Red|Blue)>)"\x20\(assister_position\x20".*"\)\x20\(attacker_position\x20".*"\)\x20\(victim_position\x20".*"\)$/], ['player triggered: captureblocked', 'playerDefended', /^"(.{1,32}<\d+><.+><(?:Red|Blue)>)"\x20triggered\x20"captureblocked"\x20\(cp\x20"\d+"\)\x20\(cpname\x20".*"\)\x20\(position\x20".*"\)$/], ['player triggered: domination or revenge', 'playerDominationOrRevenge', /^"(.{1,32}<\d+><.+><(?:Red|Blue)>)"\x20triggered\x20"(domination|revenge)"\x20against\x20"(.{1,32}<\d+><.+><(?:Red|Blue)>)"(?:\x20\(assist\x20"1"\))?$/], ['player triggered: builtobject', 'playerBuiltBuilding', /^"(.{1,32}<\d+><.+><(?:Red|Blue)>)" triggered "builtobject" \(object "\w+"\) \(position "[\d\s\-]+"\)$/], ['player triggered: killedobject', 'playerDestroyedBuilding', /^"(.{1,32}<\d+><.+><(?:Red|Blue)>)"\x20triggered\x20"killedobject"\x20\(object\x20"\w+"\)(?:\x20\(weapon\x20"\w+"\))?\x20\(objectowner\x20"(.{1,32}<\d+><.+><(?:Red|Blue)>)"\)(?:\x20\(assist\x20"1"\)\x20\(assister_position\x20"[\d\s-]+"\))?\x20\(attacker_position\x20"[\d\s\-]+"\)$/], ['player committed suicide', 'playerCommittedSuicide', /^"(.{1,32}<\d+><.+><(?:Red|Blue)>)" committed suicide with "\w+" \(attacker_position "[\d\s\-]+"\)$/], ['player got a kill', 'playerKilled', /^"(.{1,32}<\d+><.+><(?:Red|Blue)>)"\x20killed\x20"(.{1,32}<\d+><.+><(?:Red|Blue)>)"\x20with\x20"(\w+)"\x20(?:\(customkill\x20"(\w+)"\)\x20)?\(attacker_position\x20"[\d\s\-]+"\)\x20\(victim_position\x20"[\d\s\-]+"\)$/]];

  debuggingRegexTests = [['say or say_team', null, /^"(.{0,32}<\d+><STEAM_[\d:]{5,14}><(?:Red|Blue|Spectator)>)" (say|say_team) "(.*)"$/], ['Log file started', null, /^Log file started \(file.*\)$/], ['Log file closed', null, /^Log file closed$/], ['rcon command', null, /^rcon from "/], ['server message', null, /^server_message: "/], ['Metamod whatever', null, /^\[META\]/], ['Warning: whatever', null, /^WARNING: /], ['Initializing Steam whatever', null, /^\Initializing Steam /], ['Logging into whatever', null, /^\Logging into /], ['Connection to whatever', null, /^\Connection to /], ['Public IP is whatever', null, /^\   Public IP is /], ['Assigned anonymous gameserver whatever', null, /^\Assigned anonymous gameserver /], ['CTFGCServerSystem whatever', null, /^\CTFGCServerSystem /], ['VAC secure mode whatever', null, /^\VAC secure mode/], ['Received auth challenge whatever', null, /^\Received auth challenge/], ['Game server authentication whatever', null, /^\Game server authentication/], ['Executing whatever', null, /^Executing dedicated /], ['console said stuff', null, /^"Console<0><Console><Console>" say "/], ['server cvar', null, /^server_cvar: "/], ['STEAMAUTH client failure', null, /^STEAMAUTH: Client .* received failure code \d+$/], ['STEAM USERID validated', null, /^"(.*)" STEAM USERID validated$/], ['Team final score', null, /^Team "(Red|Blue)" final score "\d+" with "\d+\" players$/], ['World triggered: Round_Length', null, /^World triggered "Round_Length" \(seconds "(.+)"\)$/], ['player connected', null, /^"(.*)" connected, address "(?:none|(?:\d+\.\d+\.\d+\.\d+:\d+))"$/], ['player triggered: extinguished', null, /^"(.{1,32}<\d+><.+><(?:Red|Blue)>)"\x20triggered\x20"player_extinguished"\x20against\x20"(.{1,32}<\d+><.+><(?:Red|Blue)>)"\x20with\x20"\w+"\x20\(attacker_position\x20".*"\)\x20\(victim_position\x20".*"\)$/], ['player entered the game', null, /^"(.*)" entered the game$/], ['player spawned as', null, /^"(.{1,32}<\d+><.+><(?:Red|Blue)>)" spawned as "([a-zA-Z]+)"$/], ['player picked up item', null, /^".*>" picked up item "\w+"$/], ['World triggered: Game_Paused', null, /^World triggered "Game_Paused"$/], ['World triggered: Game_Unpaused', null, /^World triggered "Game_Unpaused"$/]];

}).call(this);