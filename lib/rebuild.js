
module.exports = exports = rebuild

exports.usage = 'Attempts to install pre-built binary for module'

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

function test_binary(opts,callback) {
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
    cp.execFile(shell_cmd, args, function(err, stdout, stderr) {
        if (err || stderr) {
            return callback(new Error(err.message || stderr));
        }        
        return callback();
    });
}

function compile(args,callback) {
    var shell_cmd = 'node-gyp';
    if (win) {
        shell_cmd = 'node-gyp.cmd';
    }
    console.log(args);
    var cmd = cp.spawn(shell_cmd,args, {cwd: undefined, env: process.env, customFds: [ 0, 1, 2]});
    cmd.on('error', function (err) {
        if (err) {
            return callback(new Error("Failed to execute '" + shell_cmd + ' ' + shell_args.join(' ') + "' (" + err + ")"));
        }
        callback();
    });
    cmd.on('close', function (err, stdout, stderr) {
        if (err) {
            return callback(new Error("Failed to execute '" + shell_cmd + ' ' + shell_args.join(' ') + "' (" + err + ")"));
        }
        callback();
    });
}


function download(url,opts,callback) {
    log.http('GET', url)

    var req = null
    var requestOpts = {
        uri: url
      , headers: {
          'User-Agent': 'node-pre-gyp (node ' + process.version + ')'
        }
    }

    var proxyUrl = opts.proxy
                || process.env.http_proxy
                || process.env.HTTP_PROXY
                || process.env.npm_config_proxy
    if (proxyUrl) {
      if (/^https?:\/\//i.test(proxyUrl)) {
        log.verbose('download', 'using proxy url: "%s"', proxyUrl)
        requestOpts.proxy = proxyUrl
      } else {
        log.warn('download', 'ignoring invalid "proxy" config setting: "%s"', proxyUrl)
      }
    }
    try {
      req = request(requestOpts)
    } catch (e) {
      callback(e)
    }
    if (req) {
      req.on('response', function (res) {
        log.http(res.statusCode, url)
      })
    }
    callback(null,req);
}

function place_binary(from,to,opts,callback) {
    download(from,opts,function(err,req) {
        if (err) return callback(err);
        if (!req) return callback(new Error("empty req"));
        var badDownload = false
            , extractCount = 0
            , gunzip = zlib.createGunzip()
            , extracter = tar.Extract({ path: to, strip: 1, filter: isValid });
        function afterTarball(err) {
            if (err) return callback(err);
            if (badDownload) return callback(new Error("bad download"));
            if (extractCount === 0) {
              return callback(new Error('There was a fatal problem while downloading/extracting the tarball'))
            }
            log.verbose('tarball', 'done parsing tarball')
            callback();
        }
        function isValid () { 
            extractCount++
            return true
        };
        gunzip.on('error', callback)
        extracter.on('error', callback)
        extracter.on('end', afterTarball)

        req.on('error', function (err) {
            badDownload = true
            callback(err)
        })

        req.on('close', function () {
            if (extractCount === 0) {
              callback(new Error('Connection closed while downloading tarball file'))
            }
        })

        req.on('response', function (res) {
            if (res.statusCode !== 200) {
              badDownload = true
              callback(new Error(res.statusCode + ' status code downloading tarball'))
              return
            }
            // start unzipping and untaring
            req.pipe(gunzip).pipe(extracter)
        })
    });
}

function validate_config(package_json,callback) {
    if (!package_json.main) {
        return callback(new Error("package.json must declare 'main'"));
    }
    if (!package_json.binary) {
        return callback(new Error("package.json must declare 'binary' object'"));
    }
    var o = package_json.binary;
    if (!o.module_path) {
        return callback(new Error("package.json must declare 'binary.module_path'"));
    }
    if (!o.module_name) {
        return callback(new Error("package.json must declare 'binary.module_name'"));
    }
    if (!o.template) {
        return callback(new Error("package.json must declare 'binary.template'"));
    }
    if (!o.remote_uri) {
        return callback(new Error("package.json must declare 'binary.remote_uri'"));
    }
    callback();
};

function eval_template(template,opts) {
    Object.keys(opts).forEach(function(key) {
        template = template.replace('{'+key+'}',opts[key]);
    });
    return template;
}

function get_node_abi() {
    // process.versions.modules added in >= v0.10.4 and v0.11.7
    // https://github.com/joyent/node/commit/ccabd4a6fa8a6eb79d29bc3bbe9fe2b6531c2d8e
    return process.versions.modules ? 'node-v' + (+process.versions.modules) : 
           'v8-' + process.versions.v8.split('.').slice(0,2).join('.');
}

function rebuild(gyp, argv, callback) {
    // @TODO - respect -C/--directory
    var package_json = JSON.parse(fs.readFileSync('./package.json'));
    validate_config(package_json,function(err) {
        if (err) return callback(err);
        if (gyp.opts['build-from-source']
            && (gyp.opts['build-from-source'] === true 
                || gyp.opts['build-from-source'] === package_json.name)) {
            return compile(['rebuild'],callback);
        }
        var module_version = semver.parse(package_json.version);
        var opts = {
            configuration: (gyp.opts.debug === true) ? 'Debug' : 'Release'
            , module_name: package_json.binary.module_name
            , major: module_version.major
            , minor: module_version.minor
            , patch: module_version.patch
            , node_abi: get_node_abi()
            , platform: process.platform
            , arch: process.arch
            , target_arch: gyp.opts.target_arch || process.arch
            , module_main: package_json.main
        }
        var versioned = eval_template(package_json.binary.template,opts);
        var from = package_json.binary.remote_uri + '/' + versioned;
        var to = package_json.binary.module_path;
        var binary_module = path.join(to,opts.module_name);
        if (existsAsync(binary_module,function(found) {
            if (found) {
                log.verbose('install','already in place');
                callback();
            } else {
                place_binary(from,to,opts,function(err) {
                    if (err) {
                        log.verbose('build','source compile required');
                        compile(['rebuild'],callback);
                    } else {
                        test_binary(opts,function(err) {
                            if (err) compile(['rebuild'],callback);
                            return callback();
                        });
                    };
                });
            }
        }));
    });
}
