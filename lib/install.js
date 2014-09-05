
module.exports = exports = install

exports.usage = 'Attempts to install pre-built binary for module'

var fs = require('fs')
  , tar = require('tar')
  , path = require('path')
  , zlib = require('zlib')
  , log = require('npmlog')
  , request = require('request')
  , existsAsync = fs.exists || path.exists
  , versioning = require('./util/versioning.js')
  , compile = require('./util/compile.js')
  , testbinary = require('./testbinary.js')
  , clean = require('./clean.js')
  , config = require('rc')("node_pre_gyp", {acl:"public-read"})

function download(uri,opts,callback) {
    log.http('GET', uri)

    var req = null
    var requestOpts = {
        uri: uri
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

    if ('strictSSL' in config) {
        requestOpts.strictSSL = config.strictSSL;
    }
    try {
      req = request(requestOpts)
    } catch (e) {
      return callback(e)
    }
    if (req) {
      req.on('response', function (res) {
        log.http(res.statusCode, uri)
      })
    }
    return callback(null,req);
}

function place_binary(from,to,opts,callback) {
    download(from,opts,function(err,req) {
        if (err) return callback(err);
        if (!req) return callback(new Error("empty req"));
        var badDownload = false
            , extractCount = 0
            , gunzip = zlib.createGunzip()
            , extracter = tar.Extract({ path: to, strip: 1});
        function afterTarball(err) {
            if (err) return callback(err);
            if (badDownload) return callback(new Error("bad download"));
            if (extractCount === 0) {
              return callback(new Error('There was a fatal problem while downloading/extracting the tarball'))
            }
            log.info('tarball', 'done parsing tarball')
            callback();
        }
        function filter_func(entry) {
            // ensure directories are +x
            // https://github.com/mapnik/node-mapnik/issues/262
            entry.props.mode |= (entry.props.mode >>> 2) & 0111;
            log.info('install','unpacking ' + entry.path);
            extractCount++
        }
        gunzip.on('error', callback)
        extracter.on('entry', filter_func)
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
              if (res.statusCode == 404) {
                  return callback(new Error('Pre-built binary not available for your system'));
              } else {
                  return callback(new Error(res.statusCode + ' status code downloading tarball'));
              }
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
        var fallback_to_build = gyp.opts['fallback-to-build'] || gyp.opts['fallback_to_build'];
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
        try {
            var opts = versioning.evaluate(package_json, gyp.opts);
        } catch (err) {
            return callback(err);
        }
        var from = opts.hosted_tarball;
        var to = opts.module_path;
        var binary_module = path.join(to,opts.module_name + '.node');
        if (existsAsync(binary_module,function(found) {
            if (found) {
                testbinary(gyp, argv, function(err) {
                    if (err) {
                        console.error('['+package_json.name+'] ' + err.message);
                        log.error("Testing local pre-built binary failed, attempting to re-download");
                        place_binary(from,to,opts,function(err) {
                            if (err) {
                                if (should_do_fallback_build) {
                                    log.http(err.message + ' (falling back to source compile with node-gyp)');
                                    return do_build(gyp,argv,callback);
                                } else {
                                    return callback(err);
                                }
                            } else {
                                console.log('['+package_json.name+'] Success: "' + binary_module + '" is reinstalled via remote');
                                return callback();
                            }
                        });
                    } else {
                        console.log('['+package_json.name+'] Success: "' + binary_module + '" already installed');
                        console.log('Pass --build-from-source to recompile');
                        return callback();
                    }
                });
            } else {
                log.info('check','checked for "' + binary_module + '" (not found)')
                place_binary(from,to,opts,function(err) {
                    if (err && should_do_fallback_build) {
                        log.http(err.message + ' (falling back to source compile with node-gyp)');
                        return do_build(gyp,argv,callback);
                    } else if (err) {
                        return callback(err);
                    } else {
                        testbinary(gyp, argv, function(err) {
                            if (err) {
                                gyp.opts.silent_clean = true;
                                clean(gyp, argv, function(error) {
                                    if (error) console.log(error);
                                    if (should_do_fallback_build) {
                                        console.error('['+package_json.name+'] ' + err.message);
                                        log.error("Testing pre-built binary failed, attempting to source compile");
                                        return do_build(gyp,argv,callback);
                                    } else {
                                        return callback(err);
                                    }
                                });
                            } else {
                                console.log('['+package_json.name+'] Success: "' + binary_module + '" is installed via remote');
                                return callback();
                            }
                        });
                    };
                });
            }
        }));
    }
};
