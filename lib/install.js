'use strict';

module.exports = exports = install;

exports.usage = 'Attempts to install pre-built binary for module';

const fs = require('fs');
const path = require('path');
const log = require('npmlog');
const existsAsync = fs.exists || path.exists;
const versioning = require('./util/versioning.js');
const napi = require('./util/napi.js');
const mkdirp = require('mkdirp');

let npgVersion = 'unknown';
try {
  // Read own package.json to get the current node-pre-pyp version.
  const ownPackageJSON = fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8');
  npgVersion = JSON.parse(ownPackageJSON).version;
} catch (e) {
  // do nothing
}

const http_get = {
  impl: undefined,
  type: undefined
};

try {
  http_get.impl = require('request');
  http_get.type = 'request';
  log.warn('Using request for node-pre-gyp https download');
} catch (e) {
  http_get.impl = require('needle');
  http_get.type = 'needle';
  log.warn('Using needle for node-pre-gyp https download');
}

function download(uri, opts, callback) {
  log.http('GET', uri);

  let req = null;

  // Try getting version info from the currently running npm.
  const envVersionInfo = process.env.npm_config_user_agent ||
        'node ' + process.version;

  const requestOpts = {
    uri: uri.replace('+', '%2B'),
    headers: {
      'User-Agent': 'node-pre-gyp (v' + npgVersion + ', ' + envVersionInfo + ')'
    },
    follow_max: 10
  };

  if (opts.cafile) {
    try {
      requestOpts.ca = fs.readFileSync(opts.cafile);
    } catch (e) {
      return callback(e);
    }
  } else if (opts.ca) {
    requestOpts.ca = opts.ca;
  }

  const proxyUrl = opts.proxy ||
                    process.env.http_proxy ||
                    process.env.HTTP_PROXY ||
                    process.env.npm_config_proxy;
  if (proxyUrl) {
    if (/^https?:\/\//i.test(proxyUrl)) {
      log.verbose('download', 'using proxy url: "%s"', proxyUrl);
      requestOpts.proxy = proxyUrl;
    } else {
      log.warn('download', 'ignoring invalid "proxy" config setting: "%s"', proxyUrl);
    }
  }
  try {
    req = http_get.impl.get(requestOpts.uri, requestOpts);
  } catch (e) {
    return callback(e);
  }
  if (req) {
    req.on('response', (res) => {
      log.http(res.statusCode, uri);
    });
  }
  return callback(null, req);
}

function place_binary(from, to, opts, callback) {
  download(from, opts, (err, req) => {
    if (err) return callback(err);
    if (!req) return callback(new Error('empty req'));
    let badDownload = false;
    let hasResponse = false;

    function afterExtract(err2, extractCount) {
      if (err2) return callback(err2);
      if (badDownload) return callback(new Error('bad download'));
      if (extractCount === 0) {
        return callback(new Error('There was a fatal problem while downloading/extracting the tarball'));
      }
      log.info('tarball', 'done parsing tarball');
      callback();
    }

    // for request compatibility
    req.on('error', (err3) => {
      badDownload = true;
      if (!hasResponse) {
        hasResponse = true;
        return callback(err3);
      }
    });

    // for needle compatibility
    req.on('err', (err4) => {
      badDownload = true;
      if (!hasResponse) {
        hasResponse = true;
        return callback(err4);
      }
    });

    req.on('close', () => {
      if (!hasResponse) {
        hasResponse = true;
        return callback(new Error('Connection closed while downloading tarball file'));
      }
    });

    req.on('response', (res) => {
      // ignore redirects, needle handles these automatically.
      if (http_get.type === 'needle' && Object.hasOwnProperty.call(res, 'location') && res.headers.location !== '') {
        return;
      }
      if (hasResponse) {
        return;
      }
      hasResponse = true;
      if (res.statusCode !== 200) {
        badDownload = true;
        const err5 = new Error(res.statusCode + ' status code downloading tarball ' + from);
        err5.statusCode = res.statusCode;
        return callback(err5);
      }
      // start unzipping and untaring
      req.pipe(extract(to, afterExtract));
    });
  });
}

function extract_from_local(from, to, callback) {
  if (!fs.existsSync(from)) {
    return callback(new Error('Cannot find file ' + from));
  }
  log.info('Found local file to extract from ' + from);
  function afterExtract(err, extractCount) {
    if (err) return callback(err);
    if (extractCount === 0) {
      return callback(new Error('There was a fatal problem while extracting the tarball'));
    }
    log.info('tarball', 'done parsing tarball');
    callback();
  }
  fs.createReadStream(from).pipe(extract(to, afterExtract));
}

function extract(to, callback) {
  let extractCount = 0;
  function filter_func(entry) {
    log.info('install', 'unpacking ' + entry.path);
    extractCount++;
  }

  function afterTarball(err) {
    callback(err, extractCount);
  }

  const tar = require('tar');
  return tar.extract({
    cwd: to,
    strip: 1,
    onentry: filter_func
  }).on('close', afterTarball).on('error', callback);
}


function do_build(gyp, argv, callback) {
  const args = ['rebuild'].concat(argv);
  gyp.todo.push({ name: 'build', args: args });
  process.nextTick(callback);
}

function print_fallback_error(err, opts, package_json) {
  const fallback_message = ' (falling back to source compile with node-gyp)';
  let full_message = '';
  if (err.statusCode !== undefined) {
    // If we got a network response it but failed to download
    // it means remote binaries are not available, so let's try to help
    // the user/developer with the info to debug why
    full_message = 'Pre-built binaries not found for ' + package_json.name + '@' + package_json.version;
    full_message += ' and ' + opts.runtime + '@' + (opts.target || process.versions.node) + ' (' + opts.node_abi + ' ABI, ' + opts.libc + ')';
    full_message += fallback_message;
    log.warn('Tried to download(' + err.statusCode + '): ' + opts.hosted_tarball);
    log.warn(full_message);
    log.http(err.message);
  } else {
    // If we do not have a statusCode that means an unexpected error
    // happened and prevented an http response, so we output the exact error
    full_message = 'Pre-built binaries not installable for ' + package_json.name + '@' + package_json.version;
    full_message += ' and ' + opts.runtime + '@' + (opts.target || process.versions.node) + ' (' + opts.node_abi + ' ABI, ' + opts.libc + ')';
    full_message += fallback_message;
    log.warn(full_message);
    log.warn('Hit error ' + err.message);
  }
}

function install(gyp, argv, callback) {
  const package_json = JSON.parse(fs.readFileSync('./package.json'));
  const napi_build_version = napi.get_napi_build_version_from_command_args(argv);
  const source_build = gyp.opts['build-from-source'] || gyp.opts.build_from_source;
  const update_binary = gyp.opts['update-binary'] || gyp.opts.update_binary;
  const should_do_source_build = source_build === package_json.name || (source_build === true || source_build === 'true');
  if (should_do_source_build) {
    log.info('build', 'requesting source compile');
    return do_build(gyp, argv, callback);
  } else {
    const fallback_to_build = gyp.opts['fallback-to-build'] || gyp.opts.fallback_to_build;
    let should_do_fallback_build = fallback_to_build === package_json.name || (fallback_to_build === true || fallback_to_build === 'true');
    // but allow override from npm
    if (process.env.npm_config_argv) {
      const cooked = JSON.parse(process.env.npm_config_argv).cooked;
      const match = cooked.indexOf('--fallback-to-build');
      if (match > -1 && cooked.length > match && cooked[match + 1] === 'false') {
        should_do_fallback_build = false;
        log.info('install', 'Build fallback disabled via npm flag: --fallback-to-build=false');
      }
    }
    let opts;
    try {
      opts = versioning.evaluate(package_json, gyp.opts, napi_build_version);
    } catch (err) {
      return callback(err);
    }

    opts.ca = gyp.opts.ca;
    opts.cafile = gyp.opts.cafile;

    const from = opts.hosted_tarball;
    const to = opts.module_path;
    const binary_module = path.join(to, opts.module_name + '.node');
    existsAsync(binary_module, (found) => {
      if (found && !update_binary) {
        console.log('[' + package_json.name + '] Success: "' + binary_module + '" already installed');
        console.log('Pass --update-binary to reinstall or --build-from-source to recompile');
        return callback();
      } else {
        if (!update_binary) log.info('check', 'checked for "' + binary_module + '" (not found)');
        mkdirp(to, (err) => {
          if (err) {
            after_place(err);
          } else {
            const fileName = from.startsWith('file://') && from.replace(/^file:\/\//, '');
            if (fileName) {
              extract_from_local(fileName, to, after_place);
            } else {
              place_binary(from, to, opts, after_place);
            }
          }
        });
      }
      function after_place(err) {
        if (err && should_do_fallback_build) {
          print_fallback_error(err, opts, package_json);
          return do_build(gyp, argv, callback);
        } else if (err) {
          return callback(err);
        } else {
          console.log('[' + package_json.name + '] Success: "' + binary_module + '" is installed via remote');
          return callback();
        }
      }
    });
  }
}
