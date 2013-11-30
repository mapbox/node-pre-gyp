
module.exports = exports = install

exports.usage = 'Attempts to install pre-build binary for module'

/**
 * Module dependencies.
 */

var fs = require('graceful-fs')
  , osenv = require('osenv')
  , tar = require('tar')
  , rm = require('rimraf')
  , path = require('path')
  , zlib = require('zlib')
  , log = require('npmlog')
  , semver = require('semver')
  , fstream = require('fstream')
  , request = require('request')
  , minimatch = require('minimatch')
  , mkdir = require('mkdirp')
  , win = process.platform == 'win32'

function test(opts,try_build,callback) {
    fs.statSync(opts.paths.runtime_module_path);
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
        // system we cannot test on - likely since we are cross compiling
        log("Skipping testing binary for " + process.target_arch);
        return callback();
    }
    args.push('lib/sqlite3');
    cp.execFile(shell_cmd, args, function(err, stdout, stderr) {
        if (err || stderr) {
            var output = err.message || stderr;
            log('Testing the binary failed: "' + output + '"');
            if (try_build) {
                log('Attempting source compile...');
                build(opts,callback);
            }
        } else {
            log('Sweet: "' + opts.binary.filename() + '" is valid, node-sqlite3 is now installed!');
            return callback();
        }
    });
}

function build(opts,callbacks) {
    var shell_cmd = opts.tool;
    if (opts.tool == 'node-gyp' && process.platform === 'win32') {
        shell_cmd = 'node-gyp.cmd';
    }
    var shell_args = ['rebuild'].concat(opts.args);
    var cmd = cp.spawn(shell_cmd,shell_args, {cwd: undefined, env: process.env, customFds: [ 0, 1, 2]});
    cmd.on('error', function (err) {
        if (err) {
            return callback(new Error("Failed to execute '" + shell_cmd + ' ' + shell_args.join(' ') + "' (" + err + ")"));
        }
    });
    cmd.on('close', function (err, stdout, stderr) {
        if (err) {
            return callback(new Error("Failed to execute '" + shell_cmd + ' ' + shell_args.join(' ') + "' (" + err + ")"));
        }
        move(opts,callback);
    });
}

function tarball(opts,callback) {
    var source = path.dirname(opts.paths.staged_module_file_name);
    log('Compressing: ' + source + ' to ' + opts.paths.tarball_path);
    new targz(9).compress(source, opts.paths.tarball_path, function(err) {
        if (err) return callback(err);
        log('Versioned binary staged for upload at ' + opts.paths.tarball_path);
        var sha1 = crypto.createHash('sha1');
        fs.readFile(opts.paths.tarball_path,function(err,buffer) {
            if (err) return callback(err);
            sha1.update(buffer);
            log('Writing shasum at ' + opts.paths.tarball_shasum);
            fs.writeFile(opts.paths.tarball_shasum,sha1.digest('hex'),callback);
        });
    });
}

function move(opts,callback) {
    try {
        fs.statSync(opts.paths.build_module_path);
    } catch (ex) {
        return callback(new Error('Build succeeded but target not found at ' + opts.paths.build_module_path));
    }
    try {
        mkdirp.sync(path.dirname(opts.paths.runtime_module_path));
        log('Created: ' + path.dirname(opts.paths.runtime_module_path));
    } catch (err) {
        log_debug(err);
    }
    fs.renameSync(opts.paths.build_module_path,opts.paths.runtime_module_path);
    if (opts.stage) {
        try {
            mkdirp.sync(path.dirname(opts.paths.staged_module_file_name));
            log('Created: ' + path.dirname(opts.paths.staged_module_file_name))
        } catch (err) {
            log_debug(err);
        }
        fs.writeFileSync(opts.paths.staged_module_file_name,fs.readFileSync(opts.paths.runtime_module_path));
        // drop build metadata into build folder
        var metapath = path.join(path.dirname(opts.paths.staged_module_file_name),'build-info.json');
        // more build info
        opts.date = new Date();
        opts.node_features = process.features;
        opts.versions = process.versions;
        opts.config = process.config;
        opts.execPath = process.execPath;
        fs.writeFileSync(metapath,JSON.stringify(opts,null,2));
        tarball(opts,callback);
    } else {
        log('Installed in ' + opts.paths.runtime_module_path + '');
        test(opts,false,callback);
    }
}

function install(gyp, argv, callback) {
    log.verbose('run', 'running: ' + JSON.stringify(gyp));

  var versionStr = argv[0];// || gyp.opts.target || process.version
  log.verbose('install', 'input version string %j', versionStr)


    callback();
}
