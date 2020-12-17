"use strict";

/**
 * Module exports.
 */

module.exports = exports;

/**
 * Module dependencies.
 */

var fs = require('fs');
var path = require('path');
var nopt = require('nopt');
var log = require('npmlog');
log.disableProgress();
var napi = require('./util/napi.js');

var EE = require('events').EventEmitter;
var inherits = require('util').inherits;
var commands = [
      'clean',
      'install',
      'reinstall',
      'build',
      'rebuild',
      'package',
      'testpackage',
      'publish',
      'unpublish',
      'info',
      'testbinary',
      'reveal',
      'configure'
    ];
var aliases = {};

// differentiate node-pre-gyp's logs from npm's
log.heading = 'node-pre-gyp';

exports.find = require('./pre-binding').find;

function Run() {
  try {
    this.package_json = JSON.parse(fs.readFileSync('./package.json'));
  } catch (e) {
    log.error(e.code, e.message);
  }

  this.commands = {};

  var self = this;
  commands.forEach(function (command) {
    self.commands[command] = function (argv, callback) {
      log.verbose('command', command, argv);
      return require('./' + command)(self, argv, callback);
    };
  });

  this.binaryHostSet = false;
}
inherits(Run, EE);
exports.Run = Run;
var proto = Run.prototype;

/**
 * Export the contents of the package.json.
 */

proto.package = require('../package.json');

/**
 * nopt configuration definitions
 */

proto.configDefs = {
    help: Boolean,     // everywhere
    arch: String,      // 'configure'
    debug: Boolean,    // 'build'
    directory: String, // bin
    proxy: String,     // 'install'
    loglevel: String,  // everywhere
};

/**
 * nopt shorthands
 */

proto.shorthands = {
    release: '--no-debug',
    C: '--directory',
    debug: '--debug',
    j: '--jobs',
    silent: '--loglevel=silent',
    silly: '--loglevel=silly',
    verbose: '--loglevel=verbose',
};

/**
 * expose the command aliases for the bin file to use.
 */

proto.aliases = aliases;

/**
 * Parses the given argv array and sets the 'opts',
 * 'argv' and 'command' properties.
 */

proto.parseArgv = function parseOpts (argv) {
  this.opts = nopt(this.configDefs, this.shorthands, argv);
  this.argv = this.opts.argv.remain.slice();
  var commands = this.todo = [];

  // create a copy of the argv array with aliases mapped
  argv = this.argv.map(function (arg) {
    // is this an alias?
    if (arg in this.aliases) {
      arg = this.aliases[arg];
    }
    return arg;
  }, this);

  // process the mapped args into "command" objects ("name" and "args" props)
  argv.slice().forEach(function (arg) {
    if (arg in this.commands) {
      var args = argv.splice(0, argv.indexOf(arg));
      argv.shift();
      if (commands.length > 0) {
        commands[commands.length - 1].args = args;
      }
      commands.push({ name: arg, args: [] });
    }
  }, this);
  if (commands.length > 0) {
    commands[commands.length - 1].args = argv.splice(0);
  }

  // expand commands entries for multiple napi builds
  var dir = this.opts.directory;
  if (dir == null) dir = process.cwd();
  var package_json = JSON.parse(fs.readFileSync(path.join(dir,'package.json')));

  this.todo = napi.expand_commands (package_json, this.opts, commands);

  // support for inheriting config env variables from npm
  var npm_config_prefix = 'npm_config_';
  Object.keys(process.env).forEach(function (name) {
    if (name.indexOf(npm_config_prefix) !== 0) return;
    var val = process.env[name];
    if (name === npm_config_prefix + 'loglevel') {
      log.level = val;
    } else {
      // add the user-defined options to the config
      name = name.substring(npm_config_prefix.length);
      // avoid npm argv clobber already present args
      // which avoids problem of 'npm test' calling
      // script that runs unique npm install commands
      if (name === 'argv') {
         if (this.opts.argv &&
             this.opts.argv.remain &&
             this.opts.argv.remain.length) {
            // do nothing
         } else {
            this.opts[name] = val;
         }
      } else {
        this.opts[name] = val;
      }
    }
  }, this);

  if (this.opts.loglevel) {
    log.level = this.opts.loglevel;
  }
  log.resume();
};

/**
 * allow the binary.host property to be set at execution time.
 *
 * for this to take effect requires all the following to be true.
 * - binary is a property in package.json
 * - binary.host is falsey
 * - binary.staging_host is not empty
 * - binary.production_host is not empty
 *
 * if any of the previous checks fail then the function returns an empty string
 * and makes no changes to package.json's binary property.
 *
 *
 * if command is "publish" then the default is set to "binary.staging_host"
 * if command is not "publish" the the default is set to "binary.production_host"
 *
 * if the command-line option '--s3-host' is set to "staging" or "production" then
 * "binary.host" is set to the specified "staging_host" or "production_host". if
 * '--s3-host' is any other value and exception is thrown.
 *
 * if '--s3-host' is not present then "binary.host" is set to the default as above.
 *
 * this strategy was chosen so that any command other than "publish" uses "production"
 * as the default without requiring any command-line options but that "publish" requires
 * '--s3-host production_host' to be specified in order to *really* publish. publishing
 * to staging can be done freely without worrying about disturbing any production releases.
 */
proto.setBinaryHostProperty = function (command) {
  if (this.binaryHostSet) {
    return;
  }
  const p = this.package_json;
  // don't set anything if host is present. it must be left blank to trigger this.
  if (!p || !p.binary || p.binary.host) {
    return '';
  }
  // and both staging and production must be present. errors will be reported later.
  if (!p.binary.staging_host || !p.binary.production_host) {
    return '';
  }
  let target = 'production_host';
  if (command === 'publish') {
    target = 'staging_host';
  }
  if (this.opts['s3-host'] === 'staging') {
    target = p.binary.staging_host;
  } else if (this.opts['s3-host'] === 'production') {
    target = p.binary.production_host;
  } else if (this.opts['s3-host']) {
    throw new Error(`invalid s3-host ${this.opts['s3-host']}`);
  }

  p.binary.host = p.binary[target];
  this.binaryHostSet = true;

  return p.binary.host;
}

/**
 * Returns the usage instructions for node-pre-gyp.
 */

proto.usage = function usage () {
  var str = [
      '',
      '  Usage: node-pre-gyp <command> [options]',
      '',
      '  where <command> is one of:',
      commands.map(function (c) {
        return '    - ' + c + ' - ' + require('./' + c).usage;
      }).join('\n'),
      '',
      'node-pre-gyp@' + this.version + '  ' + path.resolve(__dirname, '..'),
      'node@' + process.versions.node
  ].join('\n');
  return str;
};

/**
 * Version number getter.
 */

Object.defineProperty(proto, 'version', {
    get: function () {
      return this.package.version;
    },
    enumerable: true
});

