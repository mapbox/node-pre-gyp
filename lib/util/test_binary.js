module.exports = exports;

var log = require('npmlog')
  , cp = require('child_process')
  , path = require('path')

module.exports.validate = function(opts,callback) {
    var args = [];
    var options = {}
    var shell_cmd;
    var arch_names = {
        'ia32':'-i386',
        'x64':'-x86_64'
    }
    var nw = (opts.runtime && opts.runtime === 'node-webkit'); 
    if (nw) {
        options.timeout = 5000;
        if (process.platform === 'darwin') {
            shell_cmd = 'node-webkit';
        } else if (process.platform === 'win32') {
            shell_cmd = 'nw.exe';
        } else {
            shell_cmd = 'nw';
        }
        var moduleDir = process.cwd();
        var appDir = path.join(__dirname, 'nw-pre-gyp');
        args.push(appDir);
        args.push(moduleDir);
        log.info("validate","Running test command: '" + shell_cmd + ' ' + args.join(' ') + "'");
        cp.execFile(shell_cmd, args, options, function(err, stdout, stderr) {
            // check for normal timeout for node-webkit
            if (err && err.killed == true && err.signal.indexOf('SIG') > -1) {
                return callback();
            }
            if (err || stderr) {
                return callback(new Error(err && err.message || stderr));
            }
            return callback();
        });
    } else if (process.platform === 'darwin' && arch_names[opts.target_arch]) {
        shell_cmd = 'arch';
        args.push(arch_names[opts.target_arch]);
        args.push(process.execPath);
    } else if (process.arch == opts.target_arch) {
        shell_cmd = process.execPath;
    } else return callback();
    args.push('--eval');
    args.push("require('./')");
    log.info("validate","Running test command: '" + shell_cmd + ' ' + args.join(' ') + "'");
    cp.execFile(shell_cmd, args, options, function(err, stdout, stderr) {
        if (err || stderr) {
            return callback(new Error(err && err.message || stderr));
        }
        return callback();
    });
}
