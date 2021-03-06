var Discord = require('discord.js');
var fs = require('fs');

if (!fs.existsSync('./config.json')) {
    console.log('There are missing files for the bot to work properly. Please execute: "node initializer.js".');
    process.exit(1);
}

var config = require('./config.json');
var package = require('./package.json');
var disabled = require('./disabled.json');

var permissions = require('./permissions.js');
var logger = require('./logger.js');

var client = new Discord.Client();
var commands = [];
var commandPaths = [];

var customcmds;

process.on('uncaughtException', function (err) {
  logger.logError(err);
  logger.logWarning('Application in unclean state. Stopping process.');
  process.exit(1);
})

client.on('ready', () => {
  loadPlugins();
  getCommands();

  client.user.setPresence({ game: { name : config.prefix + 'help | v' + package.version, type : 0 } });

  logger.logMessage('Bot is ready');
})

client.on('message', message => {
  if (!message.content.startsWith(config.prefix) || message.channel.type == 'dm' || message.author.bot)
    return;

  var args = message.content.slice(config.prefix.length).trim().split(/ +/g);
  var command = args.shift().toLowerCase();

  if (config.deleteCommands) {
    message.delete()
      .then(() => {
        processMessage(message, command, args);
      })
      .catch((err) => {
        processMessage(message, command, args);
      })
  }
  else {
    processMessage(message, command, args);
  }
})

client.login(config.token);

function processMessage(message, command, args) {
  var processed = false;

  for (var i = 0; i < commands.length; i++) {
    if (commands[i] == command) {
      processed = true;
      var perm = permissions.isAllowed(command, message);
      if (perm.state == true) {
        logger.logMessage(`${message.author.tag} used command ${command}`);
        var cmdFile = require(commandPaths[i]);
        cmdFile.process({
          client : client,
          config : config,
          package : package,
          logger : logger,
          message : message,
          args : args
        })
      }
      else {
        message.reply(perm.message);
      }
    }
  }

  if (!processed && customcmds) {
    customcmds.onMessage(message);
  }
}

function getCommands() {
  fs.readdirSync('./commands').forEach(dir => {
    var valid = true;

    if (disabled) {
      for (var i = 0; i < disabled.commandTypes.length; i++) {
        if (disabled.commandTypes[i] == dir) {
          valid = false;
        }
      }
    }

    if (valid) {
      fs.readdirSync('./commands/' + dir).forEach(file => {
        commands.push(file.toLowerCase().substring(0, file.length - 3));
        commandPaths.push('./commands/' + dir + '/' + file);
        logger.logMessage('Loaded command : ' + file);
      })
    }
  })
}

function loadPlugins() {
  fs.readdirSync('./plugins').forEach(dir => {
    var valid = true;

    if (disabled) {
      for (var i = 0; i < disabled.plugins.length; i++) {
        if (disabled.plugins[i] == dir) {
          valid = false;
        }
      }
    }

    if (valid) {
      try {
        var plugin = require('./plugins/' + dir + '/' + dir + '.js');
        plugin.init({
          client : client,
          config : config,
          package : package,
          logger : logger
        })
        logger.logMessage('Loaded plugin : ' + dir + '.js');

        if (dir == 'customcmds') {
          customcmds = plugin;
        }
      }
      catch(err) {
        logger.logWarning('Failed to load plugin : ' + dir + '.js');
        logger.logError(err);
      }
    }
  })
}
