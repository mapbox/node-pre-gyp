
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
  , versioning = require('./util/versioning.js')
  , compile = require('./util/compile.js')


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
            log.info('tarball', 'done parsing tarball')
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
              return callback(new Error(res.statusCode + ' status code downloading tarball'))
            }
            // start unzipping and untaring
            req.pipe(gunzip).pipe(extracter)
        })
    });
}

function rebuild(gyp, argv, callback) {
    // @TODO - respect -C/--directory
    var package_json = JSON.parse(fs.readFileSync('./package.json'));
    // @TODO = if run via npm dashes will become underscore - why?
    var source_build = gyp.opts['build-from-source'] || gyp.opts['build_from_source'];
    if (source_build === package_json.name ||
        source_build === true ||
        source_build === 'true') {
        log.info('rebuild','requesting source compile');
        compile.run_gyp(['rebuild'],gyp.opts,function(err,opts) {
            return callback(err);
        });
    }
    versioning.evaluate(package_json, gyp.opts, function(err,opts) {
        if (err) return callback(err);
        var from = package_json.binary.remote_uri + '/' + opts.versioned;
        var to = package_json.binary.module_path;
        var binary_module = path.join(to,opts.module_name+'.node');
        if (existsAsync(binary_module,function(found) {
            if (found) {
                log.info('install','Sweet: "'+binary_module+'" is installed!');
                callback();
            } else {
                place_binary(from,to,opts,function(err) {
                    if (err) {
                        log.info('build','source compile required');
                        compile.run_gyp(['rebuild'],opts,function(err,opts) {
                            return callback(err);
                        });
                    } else {
                        test_binary(opts,function(err) {
                            if (err) {
                                log.info("Testing pre-built binary failed, falling back to source compile: ("+err.message+")");
                                compile.run_gyp(['rebuild'],opts,function(err,opts) {
                                    return callback(err);
                                });
                            }
                            log.info('rebuild','Sweet: "'+binary_module+'" was successfully built!');
                            return callback();
                        });
                    };
                });
            }
        }));
    });
}
