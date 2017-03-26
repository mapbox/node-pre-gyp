"use strict";

module.exports = exports = cache;

exports.usage = 'Manage the node-pre-gyp cache.';

var fs = require('fs');
var path = require('path');
var rm = require('rimraf');
var log = require('npmlog');
var versioning = require('./util/versioning');
var cache = require('./util/cache');

var ext = get_relevant_ext(versioning.default_package_name);

function get_relevant_ext(name) {
    return name.split('.').slice(-2);
}

function is_cache_object(filename) {
    var file_ext = get_relevant_ext(filename);
    for(var i = 0; i < ext.length; i++) {
        if(ext[i] !== file_ext[i]) return false;
    }
    return true;
}

function cache (gyp, argv, callback) {
    var opts;
    try {
        var package_json = JSON.parse(fs.readFileSync('./package.json'));
        opts = versioning.evaluate(package_json, gyp.opts);
    } catch(e) {
        // if the package_json config is invalid we should be able to clean
        opts = {};
    }
    cache.configure_cache_dir(opts);
    fs.readdir(opts.cache_dir, function(err, files) {
        if(err) {
            if(err.code === 'ENOENT') return callback();
            return callback(err);
        }
        function doDelete(remaining_files) {
            if(!remaining_files.length) return callback();
            var file = remaining_files[0];
            if(gyp.opts.all || is_cache_object(file)) {
                rm(path.join(opts.cache_dir, file), function() {
                    log.info('cache', 'removed cached file ' + file);
                    doDelete(remaining_files.slice(1));
                });
            } else {
                log.verbose('cache', 'not removing non-cache file ' + file);
                doDelete(remaining_files.slice(1));
            }
        }
        doDelete(files);
    });
}
