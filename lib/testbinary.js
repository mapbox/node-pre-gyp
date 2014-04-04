module.exports = exports = testbinary

exports.usage = 'Tests that the binary.node can be required'

var fs = require('fs')
  , path = require('path')
  , log = require('npmlog')
  , cp = require('child_process')
  , versioning = require('./util/versioning.js')
  , path = require('path')

function testbinary(gyp, argv, callback) {
    var args = [];
    var options = {}
    var shell_cmd;
    var arch_names = {
        'ia32':'-i386',
        'x64':'-x86_64'
    }
    var package_json = JSON.parse(fs.readFileSync('./package.json'));
    var opts = versioning.evaluate(package_json, gyp.opts);
    var nw = (opts.runtime && opts.runtime === 'node-webkit'); 
    if (nw) {
        // TODO - solve https://github.com/mapbox/node-pre-gyp/issues/63
        // for node-webkit
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
            if (err) {
                if (err.killed == true && err.signal.indexOf('SIG') > -1) {
                    return callback();
                }
                return callback(err);
            }
            return callback();
        });
        return;
    }
    if (process.platform === 'darwin' && arch_names[opts.target_arch]) {
        shell_cmd = 'arch';
        args.push(arch_names[opts.target_arch]);
        args.push(process.execPath);
    } else if (process.arch == opts.target_arch) {
        shell_cmd = process.execPath;
    } else return callback();
    args.push('--eval');
    var binary_module = path.join(opts.module_path,opts.module_name + '.node');
    args.push("require('" + binary_module +"')");
    log.info("validate","Running test command: '" + shell_cmd + ' ' + args.join(' ') + "'");
    cp.execFile(shell_cmd, args, options, function(err, stdout, stderr) {
        if (err) {
            return callback(err);
        }
        return callback();
    });
}
