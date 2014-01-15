
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

module.exports.validate = function(opts,callback) {
    var args = [];
    var shell_cmd;
    var arch_names = {
        'ia32':'-i386',
        'x64':'-x86_64'
    }
    if (process.platform === 'darwin' && arch_names[opts.target_arch]) {
        shell_cmd = 'arch';
        args.push(arch_names[opts.target_arch]);
        args.push(process.execPath);
    } else if (process.arch == opts.target_arch) {
        shell_cmd = process.execPath;
    }
    if (!shell_cmd) {
        return callback();
    }
    args.push(opts.module_main);
    log.info("validate","Running test command: '" + shell_cmd + ' ' + args.join(' '));
    cp.execFile(shell_cmd, args, function(err, stdout, stderr) {
        if (err || stderr) {
            return callback(new Error(err.message || stderr));
        }        
        return callback();
    });
}
