
module.exports = exports;

var fs = require('fs')
  , tar = require('tar')
  , path = require('path')
  , zlib = require('zlib')
  , log = require('npmlog')
  , semver = require('semver')
  , request = require('request')
  , win = process.platform == 'win32'
  , os = require('os')
  , existsAsync = fs.exists || path.exists
  , cp = require('child_process')


module.exports.run_gyp = function(args,opts,callback) {
    var shell_cmd = 'node-gyp';
    if (win) {
        shell_cmd = 'node-gyp.cmd';
    }
    var cmd = cp.spawn(shell_cmd, args, {cwd: undefined, env: process.env, customFds: [ 0, 1, 2]});
    cmd.on('error', function (err) {
        if (err) {
            return callback(new Error("Failed to execute '" + shell_cmd + ' ' + args.join(' ') + "' (" + err + ")"));
        }
        callback(null,opts);
    });
    cmd.on('close', function (err, stdout, stderr) {
        if (err) {
            return callback(new Error("Failed to execute '" + shell_cmd + ' ' + args.join(' ') + "' (" + err + ")"));
        }
        callback(null,opts);
    });
}
