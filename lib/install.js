
module.exports = exports = install

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
  , url = require('url')
  , versioning = require('./util/versioning.js')
  , compile = require('./util/compile.js')
  , test_binary = require('./util/test_binary.js')


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

function do_build(gyp,argv,callback) {
  gyp.todo.push( { name: 'build', args: ['rebuild'] } );
  process.nextTick(callback);
}

function install(gyp, argv, callback) {
    var package_json = JSON.parse(fs.readFileSync('./package.json'));
    var source_build = gyp.opts['build-from-source'] || gyp.opts['build_from_source'];
    var should_do_source_build = source_build === package_json.name || (source_build === true || source_build === 'true');
    if (should_do_source_build) {
        log.info('build','requesting source compile');
        return do_build(gyp,argv,callback);
    } else {
        var fallback_to_build = gyp.opts['fallback-to-build'] || gyp.opts['fallback_to_build '];
        var should_do_fallback_build = fallback_to_build === package_json.name || (fallback_to_build === true || fallback_to_build === 'true');
        // but allow override from npm
        if (process.env.npm_config_argv) {
            var cooked = JSON.parse(process.env.npm_config_argv).cooked;
            var match = cooked.indexOf("--fallback-to-build");
            if (match > -1 && cooked.length > match && cooked[match+1] == "false") {
                should_do_fallback_build = false;
                log.info('install','Build fallback disabled via npm flag: --fallback-to-build=false');
            }
        }
        versioning.evaluate(package_json, gyp.opts, function(err,opts) {
            if (err) return callback(err);
            var base = package_json.binary.remote_uri;
            // url.resolve needs single trailing slash
            // to behave correctly, otherwise a double slash
            // may end up in the url which breaks request
            if (base.slice(-1) != '/') {
                base = base + '/';
            }
            var from = url.resolve(base,opts.versioned);
            var to = package_json.binary.module_path;
            var binary_module = path.join(to,opts.module_name + '.node');
            if (existsAsync(binary_module,function(found) {
                if (!found) {
                    console.log('did not find ' + process.cwd() + ' ' + binary_module)
                }
                if (found) {
                    test_binary.validate(opts,function(err) {
                        if (err) {
                            console.error(err.message);
                            log.error("Testing local pre-built binary failed, attempting to re-download");
                            place_binary(from,to,opts,function(err) {
                                if (err && should_do_fallback_build) {
                                    log.info('build','source compile required');
                                    return do_build(gyp,argv,callback);
                                } else if (err) {
                                    return callback(err);
                                } else {
                                    console.log('['+package_json.name+'] Success: "' + binary_module + '" is installed');
                                    return callback();
                                }
                            });
                        } else {
                            console.log('['+package_json.name+'] Success: "' + binary_module + '" already installed');
                            console.log('Run pass --build-from-source to compile');
                            return callback();
                        }
                    });
                } else {
                    place_binary(from,to,opts,function(err) {
                        if (err && should_do_fallback_build) {
                            log.error('Source compile required: ' + err.message);
                            return do_build(gyp,argv,callback);
                        } else if (err) {
                            return callback(err);
                        } else {
                            test_binary.validate(opts,function(err) {
                                if (err && should_do_fallback_build) {
                                    console.error(err.message);
                                    log.error("Testing pre-built binary failed, attempting to source compile");
                                    return do_build(gyp,argv,callback);
                                } else if (err) {
                                    return callback(err);
                                } else {
                                    console.log('['+package_json.name+'] Success: "' + binary_module + '" is installed');
                                    return callback();
                                }
                            });
                        };
                    });
                }
            }));
        });
    }
}
