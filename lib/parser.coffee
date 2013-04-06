util = require 'util'
_ = require 'underscore'
{EventEmitter} = require 'events'

# TODO: This is so spaghetti, you have to write tests for this.


# TODO: If a player just "appears" in the middle of a match, without joining
#        a server/team/class whatever, assume that he has been playing since
#        the start of the match. Or not. This whole situation is fucked.

# TODO: Don't send updates if nothing has been parsed...


class Player
  constructor: (@name, @userId, @steamId, @team, match) ->
    @stats = {}
    @classStats = {}
    @isConnected = true
    @getMatch = -> match

    if @isPlaying
      @resetStats()

  resetStats: () ->
    # TODO: figure out a better solution for this.
    # currently, statsController breaks unless I do this:
    @stats =
      kills: 0
      killassists: 0
      medpicks: 0
      damagedone: 0
      deaths: 0
      suicides: 0
      captures: 0
      defenses: 0
      dominations: 0
      revenge: 0
      headshots: 0
      backstabs: 0
      invulns: 0
      ubersdropped: 0
      healpoints: 0
      healsreceived: 0
      buildingsbuilt: 0
      buildingsdestroyed: 0

    @classStats = {}

  isPlaying: () ->
    @isConnected && (@team == 'Blue' || @team == 'Red')

  isNotSourceTV: () ->
    # !!Object.keys(@stats).length
    !(@steamId == 'BOT' && @team == 'Spectator')

  setDisconnected: () ->
    if @isLive
      @isConnected = false
      @stopTrackingStats(true)
    else
      @deleteFromMatch()

  # setConnected: () ->
    # @isConnected = true

  setTeam: (newTeam) ->
    if (newTeam != 'Red' && newTeam != 'Blue')
      @stopTrackingStats(true)
    else if !@currentClass && @lastClass
    # For example, if a player was a scout, and then switched to spectator,
    #  and then switched to red, he would become a scout again but the logs
    #  wouldn't say so. So we do it here.
      @setClass @lastClass
    # Important to do this last
    @team = newTeam

  setClass: (newClass) ->
    if newClass && @currentClass
      # if !currentClass, then that means the player is switching from spectator
      #  to a team. Ignore the time spent "playing" a class if the player was
      #  a spectator.
      @saveTimeSpentPlayingClass()
      if Object.keys(@classStats).length == 0 and @isLive
        # This means that the player is joining a team in the middle of a game.
        #  So initialize shit.
        #  This function call does not belong here whatsoever. fuck everything
        @resetStats()

    @timeOfLastClassSwitch = @getMatch().currentTime
    if @currentClass then @lastClass = @currentClass
    @currentClass = newClass

  setName: (@name) ->

  startTrackingStats: () ->
    if @isPlaying()
      @setClass(@currentClass)
  stopTrackingStats: (unsetCurrentClass) ->
    @saveTimeSpentPlayingClass()
    if unsetCurrentClass then @setClass(null)

  saveTimeSpentPlayingClass: () ->
    return false unless @getMatch().isInPlay && @currentClass
    # If @classStats[@currentClass] doesn't exist, create it
    @classStats[@currentClass] ?= {timePlayed: 0}
    if @timeOfLastClassSwitch
      timePlayed = @getMatch().currentTime - @timeOfLastClassSwitch
      # Only add the timePlayed if it was greater than 5000ms, because
      #  we assume that the player is only cycling spawns
      if timePlayed > 5000 then @classStats[@currentClass].timePlayed += timePlayed

  addToStat: (stat, value) ->
    if !@getMatch().isInPlay then return
    @stats[stat] ?= 0
    @stats[stat] += value

  incrementStat: (stat) ->
    if !@getMatch().isInPlay then return
    @stats[stat] ?= 0
    @stats[stat]++

  decrementStat: (stat) ->
    if !@getMatch().isInPlay then return
    @stats[stat] ?= 0
    @stats[stat]--

  deleteFromMatch: () ->
    identifier = if @steamId != 'BOT' then @steamId else @userId
    delete @getMatch().players[identifier]

  getPlayedClasses: (obfuscateClassIds) ->
    bitfield = 0
    for className, classStat of @classStats
      if classStat.timePlayed
        bitfield |= 1<<(@classNameToId(className, obfuscateClassIds)-1)
    if !bitfield && @currentClass
      bitfield |= 1<<(@classNameToId(@currentClass, obfuscateClassIds)-1)
    return bitfield

  getMostPlayedClass: (obfuscateClassIds) ->
    maxTime = 0
    for className, classStat of @classStats
      if classStat.timePlayed > maxTime
        maxTime = classStat.timePlayed
        mostPlayedClass = @classNameToId(className, obfuscateClassIds)
    return mostPlayedClass || @classNameToId(@currentClass, obfuscateClassIds)

  classNameToId: (className, obfuscateClassIds) ->
    # I hate you sizzling you lazy fuck
    if obfuscateClassIds then return {
      0: 0
      scout: 1
      soldier: 3
      pyro: 7
      demoman: 4
      heavyweapons: 6
      engineer: 9
      medic: 5
      sniper: 2
      spy: 8
    }[className]
    return {
      0: 0
      scout: 1
      soldier: 2
      pyro: 3
      demoman: 4
      heavyweapons: 5
      engineer: 6
      medic: 7
      sniper: 8
      spy: 9
    }[className]
  teamNameToId: (teamName) ->
    return {
      Spectator: 1
      Red: 2
      Blue: 3
    }[teamName]
  formattedStats: (obfuscateClassIds) ->
    formattedStats = _.clone @stats
    formattedStats.name = @name
    # Important to note the lowercase "i" in formattedStats.steamid
    formattedStats.steamid = @steamId
    formattedStats.team = @teamNameToId @team
    formattedStats.mostplayedclass = @getMostPlayedClass(obfuscateClassIds)
    formattedStats.playedclasses = @getPlayedClasses(obfuscateClassIds)
    return formattedStats


class Match extends EventEmitter

  constructor: (options = {}) ->
    @verbose = options.verbose
    @debug = options.debug
    @initialize()

    if @debug then @regexTests = regexTests.concat debuggingRegexTests
    else @regexTests = regexTests

  initialize: () ->
    @isLive = false
    @isInPlay = false
    @players = {}
    @chats = []

  resetScore: () ->
    @redLastScore = 0
    @redCurrentScore = 0
    @redRoundsWon = 0
    @bluLastScore = 0
    @bluCurrentScore = 0
    @bluRoundsWon = 0

  # setMap: (@map) ->

  # setIgnoreLog: (@ignoreLog) ->

  startMatch: () ->
    @isLive = true
    @currentRound = 0
    @resetScore()
    @startTime = @currentTime
    # @emit 'match start', @formattedStats(true, false)
    @verbose && console.log '*** Starting match at', @startTime

  startRound: () ->
    @roundStartTime = @currentTime
    @teamfirstcap = 0
    if @isLive
      @currentRound++
    else
      @startMatch()

    for id, player of @players when player.isNotSourceTV()
      player.resetStats()
      player.startTrackingStats()
    @isInPlay = true
    @verbose && console.log '* Starting round', @currentRound

  endRound: (team) ->
    @verbose && console.log "* #{team} won round #{@currentRound}."
    for id, player of @players
      player.stopTrackingStats()
    @isInPlay = false
    if team == 'Red' then @redRoundsWon++
    else if team == 'Blue' then @bluRoundsWon++
  endMatch: () ->
    return if not @isLive
    @isLive = false
    @isInPlay = false # Just in case?? I dunooo
    @emit 'match end', @chats, (@currentTime - @startTime)/1000
    @verbose && console.log "*** Game Over."
    # @verbose && @printInfo()
    @initialize() # 'new' parser only

  setTeamScore: (team, score) ->
    if team == 'Red'
      @redLastScore = @redCurrentScore
      @redCurrentScore = score
    else if team == 'Blue'
      @bluLastScore = @bluCurrentScore
      @bluCurrentScore = score
    # Oddly enough, this is when we know we have all the round's information
    # That is, when this gets called a 2nd time.
    if @numberOfTimesThisThingWasCalled
      @numberOfTimesThisThingWasCalled = 0
      @emit 'round end', @formattedStats(false, true)
      @bluLastScore = @bluCurrentScore
      @redLastScore = @redCurrentScore
      @chats = []
    else
      @numberOfTimesThisThingWasCalled = 1

  setCurrentTime: (@currentTime) ->

  formattedStats: (isMatchStart, sendChats) ->
    stats =
      bluscore: @bluCurrentScore - @bluLastScore
      redscore: @redCurrentScore - @redLastScore
      teamfirstcap: @teamfirstcap
      roundduration: (@currentTime - @roundStartTime)/1000
      players: []
    if isMatchStart
      stats.map = @map || 'cp_whatever'
      stats.hostname = 'test server'
      stats.bluname = 'BLU'
      stats.redname = 'RED'
    if sendChats then stats.chats = @chats
    stats.players.push player.formattedStats(true) for id, player of @players
    return stats

  trustedFormattedStats: () ->
    stats =
      bluscore: @bluCurrentScore - @bluLastScore
      redscore: @redCurrentScore - @redLastScore
      teamfirstcap: @teamfirstcap
      roundduration: (@currentTime - @roundStartTime)/1000
      players: {}
    # if sendChats then stats.chats = @chats
    stats.players[id] = player.formattedStats(false) for id, player of @players
    return stats

  # delete this stupid thing
  # printInfo: () ->
  #   msToHMS = (ms) ->
  #     ms /= 1000
  #     h = parseInt(ms/3600, 10)
  #     m = parseInt((ms-h*3600)/60, 10)
  #     s = ms-h*3600-m*60
  #     if h == 0
  #       return ('0'+m).slice(-2)+':'+('0'+s).slice(-2)
  #     return h+':'+('0'+m).slice(-2)+':'+('0'+s).slice(-2)

  #   for id, player of @players
  #     for className, classStats of player.classStats when classStats.timePlayed
  #       classStats.timePlayed = msToHMS(classStats.timePlayed)
  #     # unless player.hasStats() then delete @players[id]
  #   console.log util.inspect(@players, {depth: null})
  #   console.log 'redscore:', @redScore, 'redroundswon:', @redRoundsWon
  #   console.log 'bluscore:', @bluScore, 'bluroundswon:', @bluRoundsWon
  #   console.log 'teamfirstcap:', @teamfirstcap

  getOrInsertPlayer: (ignore, name, userId, steamId, team) ->
    identifier = if steamId != 'BOT' then steamId else userId

    return @players[identifier] if @players[identifier]
    return @players[identifier] = new Player(name, userId, steamId, team, @)

  parse: (line) ->
    return unless line
    self = @

    # This is to remove stupid windows CRLF. Don't have to do this if parsing
    #  lines from my UDP server, it'll already be cut off.
    # if line[line.length-1] == '\r'
      # line = line.slice(0,-1)
    if line.substring(0,2) != 'L ' or !(line.length > 25)
      return console.log 'malformed', line
    originalLine = line
    line = line.substring(2)

    # TODO: Do a regex test for `month/day/year - hour/minute/second:` format
    # Check for malformed timestamp

    @setCurrentTime new Date(
      parseInt line.substring(6,10), 10     # year
     (parseInt line.substring(0,2), 10)-1   # months are 0-based in js. why???
      parseInt line.substring(3,5), 10      # day
      parseInt line.substring(13,15), 10    # hour
      parseInt line.substring(16,18), 10    # minute
      parseInt line.substring(19,21), 10    # second
    )

    line = line.substring(23)

    # If ignoring log, then start listening again when you see this:
    if @ignoreLog
      if /^server cvars end$/.test(line) then @ignoreLog = false
      return

    @runTests line, @regexTests, (matchingTests) ->
      if self.debug && matchingTests.length != 1
        console.log 'Problem with line', originalLine
        if matchingTests.length == 0
          console.log 'not found'
        else if matchingTests.length > 1
          console.log 'more than 1 test matched', matchingTests

  parsePlayer: (playerString, cb) ->
    regex = /// ^
      ((?:(?!STEAM).){1,32})              # Player's name, must not contain 'STEAM'
      <(\d+)>                             # Player's userId
      <(BOT|STEAM_\d:[0-1]:\d{1,10})>     # Player's steamId
      <(Blue|Red|Spectator|Unassigned)?>  # Player's team
    $ ///
    info = playerString.match(regex)
    return cb('ERROR with playerString: ' + playerString) unless info
    cb null, @getOrInsertPlayer(info...)

  runTests: (line, regexTests, cb) ->
    matchingTests = []
    for regexTest in regexTests
      [description, handler, regex] = regexTest
      captured = line.match(regex)
      if captured
        if handler then handlers[handler].apply(@, captured)
        if @debug then matchingTests.push description
        else break
    cb matchingTests

  shutdown: (line) ->



module.exports = Match


handlers =
  loadingMap: (line, map) ->
    this.setIgnoreLog true
    this.initialize()
    this.setMap map

  roundStart: () ->
    this.startRound()
  roundWin: (line, team) ->
    this.endRound team
  roundStalemate: (line) ->
    this.endRound()
  gameOver: (line) ->
    this.endMatch()

  # playerConnected: (line, playerString, ip, port) ->
  #   this.parsePlayer playerString, (err, player) ->
  #     return console.log err if err
  #     player.setConnected()

  playerJoinedTeam: (line, playerString, team) ->
    this.parsePlayer playerString, (err, player) ->
      return console.log err if err
      player.setTeam team

  playerChangedClass: (line, playerString, newClass) ->
    this.parsePlayer playerString, (err, player) ->
      return console.log err if err
      player.setClass newClass

  playerChangedName: (line, playerString, newName) ->
    this.parsePlayer playerString, (err, player) ->
      return console.log err if err
      player.setName newName

  playerDisconnected: (line, playerString, reason) ->
    this.parsePlayer playerString, (err, player) ->
      return console.log err if err
      player.setDisconnected()

  playerSaid: (line, playerString, type, body) ->
    this.parsePlayer playerString, (err, player) ->
      return console.log err if err
      return unless this.isLive
      this.chats.push {
        steamid: player.steamId
        isTeam: type == 'say_team'
        time: (this.currentTime - this.startTime)/1000
        message: body
      }

  playerKilled: (line, playerString, victimString, weapon, customkill) ->
    self = @
    self.parsePlayer playerString, (err, player) ->
      return console.log err if err
      if customkill
        return if customkill == 'feign_death'
        player.incrementStat(customkill+'s')
      player.incrementStat 'kills'
      self.parsePlayer victimString, (err, victim) ->
        return console.log err if err
        victim.incrementStat 'deaths'

  playerAssisted: (line, playerString) ->
    this.parsePlayer playerString, (err, player) ->
      return console.log err if err
      player.incrementStat('killassists')

  playerDealtDamage: (line, playerString, damage) ->
    this.parsePlayer playerString, (err, player) ->
      return console.log err if err
      player.addToStat 'damagedone', parseInt(damage,10)

  playerUbered: (line, playerString) ->
    this.parsePlayer playerString, (err, player) ->
      return console.log err if err
      player.incrementStat 'invulns'

  playerBuiltBuilding: (line, playerString) ->
    this.parsePlayer playerString, (err, player) ->
      return console.log err if err
      player.incrementStat 'buildingsbuilt'

  playerDestroyedBuilding: (line, playerString) ->
    this.parsePlayer playerString, (err, player) ->
      return console.log err if err
      player.incrementStat 'buildingsdestroyed'

  playerHealed: (line, playerString, victimString, value) ->
    # TODO: Distinguish between medic heals and engineer heals
    this.parsePlayer playerString, (err, player) ->
      return console.log err if err
      player.addToStat 'healpoints', parseInt(value,10)
    this.parsePlayer victimString, (err, victim) ->
      return console.log err if err
      victim.addToStat 'healsreceived', parseInt(value,10)

  # TODO: Test this one
  playerExtinguished: (line, playerString) ->
    # TODO: Distinguish between medic extinguishes and pyro extinguishes
    this.parsePlayer playerString, (err, player) ->
      return console.log err if err
      player.incrementStat 'extinguishes'

  playerKilledMedic: (line, playerString, victimString, medicDropped) ->
    this.parsePlayer playerString, (err, player) ->
      return console.log err if err
      player.incrementStat 'medpicks'
    if parseInt(medicDropped, 10)
      this.parsePlayer victimString, (err, victim) ->
        return console.log err if err
        victim.incrementStat 'ubersdropped'

  playerCommittedSuicide: (line, playerString) ->
    this.parsePlayer playerString, (err, player) ->
      return console.log err if err
      player.incrementStat 'suicides'
      player.incrementStat 'deaths'

  playerDominationOrRevenge: (line, playerString, type, victimString) ->
    # the stat is called "dominations" or "revenge"
    type += 's' if type == 'domination'
    this.parsePlayer playerString, (err, player) ->
      return console.log err if err
      player.incrementStat type

  playerDefended: (line, playerString) ->
    this.parsePlayer playerString, (err, player) ->
      return console.log err if err
      player.incrementStat 'defenses'

  teamCurrentScore: (line, team, score) ->
    this.setTeamScore(team, parseInt(score,10))

  teamCapturedPoint: (line, team, cp, numCappers, restOfLine) ->
    if !this.teamfirstcap then this.teamfirstcap = {Red:2, Blue:3}[team]
    numCappers = parseInt(numCappers,10)
    regexString = '^'
    for i in [0...numCappers] by 1
      regexString += ' \\(player\\d+ "(.*<\\d+><.+><(?:Red|Blue)>)"\\)' +
                     ' \\(position\\d+ ".*"\\)'
    # I don't know why, but I have to save the $ back to the string.
    #  Concatenating it in the `new RegExp()` expression fails for some reason.
    regexString += '$'
    cappers = restOfLine.match(new RegExp regexString).slice(1)
    if !cappers then return false
    for capper in cappers
      this.parsePlayer capper, (err, player) ->
        return console.log err if err
        player.incrementStat 'captures'

  # "Trusted" sizzlingstats stuff, to handle differently
  sizzlingPlayerRole: (line, name, userId, steamId, team, role) ->
    player = @getOrInsertPlayer(null, name, userId, steamId, team)
    if role == 'undefined' then role = null
    player.setClass(role)

  sizzlingSessionId: (line, sessionId) ->
    @emit 'got sessionid', sessionId

regexTests = [
  # [SizzlingStats] events
  [ 'SizzlingStats: Match Started'
    'roundStart'
    /^\[SizzlingStats\]: Match Started$/ ]

  [ 'SizzlingStats: player is role'
    'sizzlingPlayerRole'
    /^\[SizzlingStats\]: player "(.{1,32})"<(.+)><(.+)><(.+)> is role (\w+)$/ ]

  [ 'SizzlingStats: sessionid'
    'sizzlingSessionId'
    /^\[SizzlingStats\]: sessionid (.*)$/ ]


  [ 'Team current score'
    'teamCurrentScore'
    /^Team "(Red|Blue)" current score "(\d+)" with "\d+\" players$/ ]

  # Game state
  [ 'World triggered: Round_Start',
    'roundStart'
    /^World triggered "Round_Start"$/ ]
  [ 'World triggered: Round_Win'
    'roundWin'
    /^World triggered "Round_Win" \(winner "(Blue|Red)"\)$/ ]
  [ 'World triggered: Round_Stalemate'
    'roundStalemate'
    /^World triggered "Round_Stalemate"$/ ]
  [ 'World triggered: Game_Over'
    'gameOver'
    /^World triggered "Game_Over" reason ".*"$/ ]
  [ 'team triggered: Intermission_Win_Limit'
    'gameOver'
    /^Team "(?:RED|BLUE)" triggered "Intermission_Win_Limit"$/ ]

  # Player events
  [ 'player joined a team'
    'playerJoinedTeam'
    # safe
    /^"(.{1,32}<\d+><.+><(?:Red|Blue|Spectator|Unassigned)>)" joined team "(Red|Blue|Spectator)"$/ ]
  [ 'player changed class'
    'playerChangedClass'
    # safe
    /^"(.{1,32}<\d+><.+><(?:Red|Blue)>)" changed role to "([a-z]+)"$/ ]

  [ 'player changed name'
    'playerChangedName'
    # NOT safe
    /^"(.{1,32}<\d+><.+><(?:Red|Blue|Spectator)>)" changed name to "(.+)"$/ ]
  [ 'player disconnected'
    'playerDisconnected'
    # NOT safe
    /// ^
      "(.{0,32}<\d+><(?:BOT|STEAM_[\d:]{5,14})><(?:Red|Blue|Spectator)?>)"
      \x20 disconnected \x20
      \(reason \x20 "(.*)"\)
    $ /// ]


  [ 'team triggered: pointcaptured'
    'teamCapturedPoint'
    /// ^
      Team \x20 "(Red|Blue)"              # which team capped
      \x20 triggered \x20 "pointcaptured"
      \x20 \(cp \x20 "(\d+)"\)            # which cp was capped
      \x20 \(cpname \x20 ".*"\)           # don't care
      \x20 \(numcappers \x20 "(\d+)"\)    # number of cappers
      (.*)                                # stuff to parse
      \x20                                # why is there an extra space???
    $ /// ]

  [ 'player triggered: playerDamage'
    'playerDealtDamage'
    # safe
    /^"(.{1,32}<\d+><.+><(?:Red|Blue)>)" triggered "damage" \(damage "(\d+)"\)$/ ]

  [ 'player triggered: chargedeployed',
    'playerUbered',
    # safe
    /^"(.{1,32}<\d+><.+><(?:Red|Blue)>)" triggered "chargedeployed"$/ ]

  [ 'player triggered: heal'
    'playerHealed'
    /// ^
      "(.{1,32}<\d+><.+><(?:Red|Blue)>)"  # player's info
      \x20 triggered \x20 "healed"
      \x20 against \x20
      "(.{1,32}<\d+><.+><(?:Red|Blue)>)"  # victim's info
      \x20 \(healing \x20 "(\d+)"\)       # healing amount
    $ /// ]

  [ 'player triggered: medic_death'
    'playerKilledMedic'
    /// ^
      "(.{1,32}<\d+><.+><(?:Red|Blue)>)"  # player's info
      \x20 triggered \x20 "medic_death"
      \x20 against \x20
      "(.{1,32}<\d+><.+><(?:Red|Blue)>)"  # victim's info
      \x20 \(healing \x20 "\d+"\)         # don't know what this is
      \x20 \(ubercharge \x20 "([0-1])"\)    # 1 if the medic dropped, 0 otherwise
    $ /// ]

  [ 'player triggered: kill assist'
    'playerAssisted'
    /// ^
      "(.{1,32}<\d+><.+><(?:Red|Blue)>)"
      \x20 triggered \x20 "kill \x20 assist"
      \x20 against \x20
      "(.{1,32}<\d+><.+><(?:Red|Blue)>)"
      \x20 \(assister_position \x20 ".*"\)
      \x20 \(attacker_position \x20 ".*"\)
      \x20 \(victim_position \x20 ".*"\)
    $ /// ]

  [ 'player triggered: captureblocked'
    'playerDefended'
    /// ^
      "(.{1,32}<\d+><.+><(?:Red|Blue)>)"
      \x20 triggered \x20 "captureblocked"
      \x20 \(cp \x20 "\d+"\)
      \x20 \(cpname \x20 ".*"\)
      \x20 \(position \x20 ".*"\)
     $ /// ]

  [ 'player triggered: domination or revenge'
    'playerDominationOrRevenge'
    /// ^
      "(.{1,32}<\d+><.+><(?:Red|Blue)>)" \x20
      triggered \x20 "(domination|revenge)"
      \x20 against \x20
      "(.{1,32}<\d+><.+><(?:Red|Blue)>)"
      (?: \x20 \(assist \x20 "1"\))?
    $ /// ]

  [ 'player triggered: builtobject'
    'playerBuiltBuilding'
    # safe
    /^"(.{1,32}<\d+><.+><(?:Red|Blue)>)" triggered "builtobject" \(object "\w+"\) \(position "[\d\s\-]+"\)$/ ]
  [ 'player triggered: killedobject'
    'playerDestroyedBuilding'
    /// ^
      "(.{1,32}<\d+><.+><(?:Red|Blue)>)"
      \x20 triggered \x20 "killedobject"
      \x20 \(object \x20 "\w+"\)
      (?:\x20 \(weapon \x20 "\w+"\))?
      \x20 \(objectowner \x20
      "(.{1,32}<\d+><.+><(?:Red|Blue)>)"\)
      (?:\x20 \(assist \x20 "1"\) \x20 \(assister_position \x20 "[\d\s-]+"\))?
      \x20 \(attacker_position \x20 "[\d\s\-]+"\)
    $ /// ]


  [ 'player committed suicide'
    'playerCommittedSuicide'
    # safe
    /^"(.{1,32}<\d+><.+><(?:Red|Blue)>)" committed suicide with "\w+" \(attacker_position "[\d\s\-]+"\)$/ ]

  [ 'player got a kill'
    'playerKilled'
    /// ^
      "(.{1,32}<\d+><.+><(?:Red|Blue)>)"        # player's info
      \x20 killed \x20
      "(.{1,32}<\d+><.+><(?:Red|Blue)>)"        # victim's info
      \x20 with \x20 "(\w+)" \x20               # name of weapon
      (?:\(customkill \x20 "(\w+)"\) \x20)?     # e.g. "headshot"
      \(attacker_position \x20 "[\d\s\-]+"\) \x20
      \(victim_position \x20 "[\d\s\-]+"\)
    $ /// ]
]


# Stuff I don't care about, hence null
debuggingRegexTests = [
  [ 'say or say_team'
    null
    # 'playerSaid'
    # NOT safe
    /^"(.{0,32}<\d+><STEAM_[\d:]{5,14}><(?:Red|Blue|Spectator)>)" (say|say_team) "(.*)"$/ ]

  ['Log file started', null, /^Log file started \(file.*\)$/]
  ['Log file closed', null, /^Log file closed$/]

  ['rcon command', null, /^rcon from "/]
  ['server message', null, /^server_message: "/]

  ['Metamod whatever', null, /^\[META\]/]
  # ['SizzlingStats whatever', null, /^\[SizzlingStats\]/]
  ['Warning: whatever', null, /^WARNING: /]
  ['Initializing Steam whatever', null, /^\Initializing Steam /]
  ['Logging into whatever', null, /^\Logging into /]
  ['Connection to whatever', null, /^\Connection to /]
  ['Public IP is whatever', null, /^\   Public IP is /]
  ['Assigned anonymous gameserver whatever', null, /^\Assigned anonymous gameserver /]
  ['CTFGCServerSystem whatever', null, /^\CTFGCServerSystem /]
  ['VAC secure mode whatever', null, /^\VAC secure mode/]
  ['Received auth challenge whatever', null, /^\Received auth challenge/]
  ['Game server authentication whatever', null, /^\Game server authentication/]
  ['Executing whatever', null, /^Executing dedicated /]

  ['console said stuff', null, /^"Console<0><Console><Console>" say "/]
  ['server cvar', null, /^server_cvar: "/]
  ['STEAMAUTH client failure', null, /^STEAMAUTH: Client .* received failure code \d+$/]
  ['STEAM USERID validated', null, /^"(.*)" STEAM USERID validated$/]


  ['Team final score', null, /^Team "(Red|Blue)" final score "\d+" with "\d+\" players$/]
  [ 'World triggered: Round_Length'
    null
    /^World triggered "Round_Length" \(seconds "(.+)"\)$/ ]
  [ 'player connected'
    # 'playerConnected'
    # this log message is pretty useless, it seems like ip/port is the
    # server's local address
    null
    # /^"(.*)" connected, address "(\d+\.\d+\.\d+\.\d+):(\d+)"$/
    /^"(.*)" connected, address "(?:none|(?:\d+\.\d+\.\d+\.\d+:\d+))"$/ ]

  [ 'player triggered: extinguished'
    # 'playerExtinguished'
    null
    /// ^
      "(.{1,32}<\d+><.+><(?:Red|Blue)>)"
      \x20 triggered \x20 "player_extinguished"
      \x20 against \x20
      "(.{1,32}<\d+><.+><(?:Red|Blue)>)"
      \x20 with \x20 "\w+"
      \x20 \(attacker_position \x20 ".*"\)
      \x20 \(victim_position \x20 ".*"\)
    $ /// ]

  ['player entered the game', null, /^"(.*)" entered the game$/]

  ['player spawned as', null, /^"(.{1,32}<\d+><.+><(?:Red|Blue)>)" spawned as "([a-zA-Z]+)"$/]

  [ 'player picked up item', null,
    /^".*>" picked up item "\w+"$/ ]

  ['World triggered: Game_Paused', null, /^World triggered "Game_Paused"$/]
  ['World triggered: Game_Unpaused', null, /^World triggered "Game_Unpaused"$/]
]

