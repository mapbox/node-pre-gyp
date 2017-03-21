"use strict";

var fs = require('fs');
var os = require('os');
var path = require('path');
var log = require('npmlog');
var versioning = require('./versioning.js');

module.exports.unlink_and_ignore = unlink_and_ignore;
function unlink_and_ignore(path) {
    fs.unlink(path, function (err) {
        if(err) {
            if(err.code !== 'ENOENT') {
                log.verbose('cache', 'removing cache failed', err);
            }
            return;
        }
        log.verbose('cache', 'cache removed');
    });
}


module.exports.configure_cache_dir = configure_cache_dir;
function configure_cache_dir(opts) {
    try {
        opts.cache_dir = process.env.NODE_PRE_GYP_CACHE || process.env.npm_config_node_pre_gyp_cache || path.join(os.homedir(), '.node-pre-gyp');
    } catch(e) {
        opts.ignore_cache = true;
    }
}

module.exports.configure_cache_path = configure_cache_path;
function configure_cache_path(opts) {
    if(!opts.cache_dir) {
        configure_cache_dir(opts);
    }
    if(opts.cache_dir) {
        opts.cache_path = path.join(opts.cache_dir,versioning.eval_template(versioning.default_package_name, opts));
    }
}

module.exports.write_to_cache = write_to_cache;
function write_to_cache(source, opts) {
    if(!opts.cache_path) return;
    try {
        fs.mkdirSync(opts.cache_dir);
    } catch (e) {
        if(e.code !== 'EEXIST') {
            log.warn('cache', 'could not create cache dir ' + e.message);
        }
    }
    var cache_ws = fs.createWriteStream(opts.cache_path);
    cache_ws.on('error', function(err) {
        log.warn('cache', 'could not write to cache ' + err.message);
        unlink_and_ignore(opts.cache_path);
    });
    source.pipe(cache_ws);
}

module.exports.retrieve_from_cache = retrieve_from_cache;
function retrieve_from_cache(opts,callback) {
    var cache_rs;
    try {
        fs.mkdirSync(opts.cache_dir);
    } catch (e) {
        if(e.code !== 'EEXIST') {
            log.warn('cache', 'could not create cache dir ' + e.message);
            return callback(e);
        }
    }
    console.log('retrieve_from_cache', opts.cache_path);
    cache_rs = fs.createReadStream(opts.cache_path);
    cache_rs.on('error', function(err) {
        unlink_and_ignore(opts.cache_path);
        if(err.code === 'ENOENT') {
            log.verbose('cache', 'cache not found');
        } else {
            log.warn('cache', 'error while reading cache', err);
        }
        cache_rs.removeAllListeners();
        return callback(err);
    });
    cache_rs.on('open', function readFromCache() {
        callback(null, cache_rs);
    });
}

