'use strict';

const cp = require('child_process');
const path = require('path');


/*

Convenience function to call out to local node-pre-gyp or npm

*/

const cmd_path = path.join(__dirname, '../bin/');
let sep = ':';
if (process.platform === 'win32') {
  sep = ';';
}

function run(prog, command, args, app, opts, cb) {

  // validate args
  if (!prog) throw new Error('prog arg undefined');
  if (!command) throw new Error('command arg undefined');
  if (!app) throw new Error('app arg undefined');
  if (!app.name) throw new Error('app.name undefined');

  // start forming up the command we will execute.
  // here we add the program and the command
  let final_cmd = prog + ' ' + command;

  // if we are calling out to `node-pre-gyp` let's ensure we directly
  // call the local version at a relative path (to avoid the change) we might
  // use some external version on PATH
  if (final_cmd.indexOf('node-pre-gyp') > -1) {
    final_cmd = cmd_path + final_cmd;
    if (opts.npg_debug) {
      console.log(`found node-pre-gyp, final_cmd="${final_cmd}"`);
    }
  }

  // if npm we need to put our local node_gyp on path
  if (final_cmd.indexOf('npm') > -1) {
    opts.env = process.env;
    // needed for npm to find node-pre-gyp locally
    opts.env.PATH = cmd_path + sep + process.env.PATH;

    // needed for apps that require node-pre-gyp to find local module
    // since they don't install a copy in their node_modules
    opts.env.NODE_PATH = path.join(__dirname, '../lib/');

    if (opts.npg_debug) {
      console.log(`found npm, final_cmd now="${final_cmd}"`);
    }
  }

  // unless explicitly provided, lets execute the command inside the app specific directory
  if (!opts.cwd) {
    opts.cwd = path.join(__dirname, app.name);
  }

  // Test building with msvs 2015 since that is more edge case than 2013
  if (process.platform === 'win32') {
    final_cmd += ' --msvs_version=2015 ';
  }

  // finish appending all arguments
  final_cmd += ' ' + app.args;
  final_cmd += ' ' + args;


  // On unix we want to display compile args (rather than have them hidden)
  // for easier debugging of unexpected compile failures.
  // We do this by pre-pending the magic variable that make responds to.
  if (process.platform !== 'win32') {
    final_cmd = 'V=1 ' + final_cmd;
  }

  if (opts.npg_debug) {
    if (opts.npg_debug === 'env') {
      console.log('executing:', final_cmd, opts);
    } else {
      const someOpts = Object.assign({}, opts);
      delete someOpts.env;
      console.log('executing:', final_cmd, someOpts);
    }
    delete opts.npg_debug;
  }

  // Finally, execute the command
  cp.exec(final_cmd, opts, (err, stdout, stderr) => {
    if (err) {
      const error = new Error("Command failed '" + final_cmd + "'");
      error.stack = stderr;
      return cb(error, stdout, stderr);
    }
    return cb(err, stdout, stderr);
  });
}

module.exports = run;
