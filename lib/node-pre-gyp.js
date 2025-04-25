'use strict';

/**
 * Module exports.
 */

module.exports = exports;

/**
 * Module dependencies.
 */

const fs = require('fs');
const path = require('path');
const nopt = require('nopt');
const log = require('./util/log.js');
const napi = require('./util/napi.js');

const EE = require('events').EventEmitter;
const inherits = require('util').inherits;
const cli_commands = [
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
const aliases = {};

// this is a getter to avoid circular reference warnings with node v14.
Object.defineProperty(exports, 'find', {
  get: function() {
    return require('./pre-binding').find;
  },
  enumerable: true
});

// in the following, "my_module" is using node-pre-gyp to
// prebuild and install pre-built binaries. "main_module"
// is using "my_module".
//
// "bin/node-pre-gyp" invokes Run() without a path. the
// expectation is that the working directory is the package
// root "my_module". this is true because in all cases npm is
// executing a script in the context of "my_module".
//
// "pre-binding.find()" is executed by "my_module" but in the
// context of "main_module". this is because "main_module" is
// executing and requires "my_module" which is then executing
// "pre-binding.find()" via "node-pre-gyp.find()", so the working
// directory is that of "main_module".
//
// that's why "find()" must pass the path to package.json.
//
function Run({ package_json_path = './package.json', argv }) {
  this.package_json_path = package_json_path;
  this.commands = {};

  const self = this;
  cli_commands.forEach((command) => {
    self.commands[command] = function(argvx, callback) {
      log.verbose('command', command, argvx);
      return require('./' + command)(self, argvx, callback);
    };
  });

  this.parseArgv(argv);
}

inherits(Run, EE);
exports.Run = Run;
const proto = Run.prototype;

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
  loglevel: String  // everywhere
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
  verbose: '--loglevel=verbose'
};

/**
 * expose the command aliases for the bin file to use.
 */

proto.aliases = aliases;

/**
 * Parses the given argv array and sets the 'opts', 'argv',
 * 'command', and 'package_json' properties.
 */

proto.parseArgv = function parseOpts(argv) {
  this.opts = nopt(this.configDefs, this.shorthands, argv);
  this.argv = this.opts.argv.remain.slice();
  const commands = this.todo = [];

  // create a copy of the argv array with aliases mapped
  argv = this.argv.map((arg) => {
    // is this an alias?
    if (arg in this.aliases) {
      arg = this.aliases[arg];
    }
    return arg;
  });

  // process the mapped args into "command" objects ("name" and "args" props)
  argv.slice().forEach((arg) => {
    if (arg in this.commands) {
      const args = argv.splice(0, argv.indexOf(arg));
      argv.shift();
      if (commands.length > 0) {
        commands[commands.length - 1].args = args;
      }
      commands.push({ name: arg, args: [] });
    }
  });
  if (commands.length > 0) {
    commands[commands.length - 1].args = argv.splice(0);
  }


  // if a directory was specified package.json is assumed to be relative
  // to it.
  let package_json_path = this.package_json_path;
  if (this.opts.directory) {
    package_json_path = path.join(this.opts.directory, package_json_path);
  }

  this.package_json = JSON.parse(fs.readFileSync(package_json_path));

  // expand commands entries for multiple napi builds
  this.todo = napi.expand_commands(this.package_json, this.opts, commands);

  // support for inheriting config env variables from npm
  const npm_config_prefix = 'npm_config_';
  Object.keys(process.env).forEach((name) => {
    if (name.indexOf(npm_config_prefix) !== 0) return;
    const val = process.env[name];
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
  });

  if (this.opts.loglevel) {
    log.level = this.opts.loglevel;
  }
  log.resume();
};

/**
 * Returns the usage instructions for node-pre-gyp.
 */

proto.usage = function usage() {
  const str = [
    '',
    '  Usage: node-pre-gyp <command> [options]',
    '',
    '  where <command> is one of:',
    cli_commands.map((c) => {
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
  get: function() {
    return this.package.version;
  },
  enumerable: true
});
