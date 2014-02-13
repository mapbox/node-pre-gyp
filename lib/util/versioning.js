
module.exports = exports;

var path = require('path')
  , semver = require('semver')
  , url = require('url')
  , abi_crosswalk = require('./abi_crosswalk.json')
  , nw_crosswalk = require('./nw_crosswalk.json')

function eval_template(template,opts) {
    Object.keys(opts).forEach(function(key) {
        var pattern = '{'+key+'}';
        while (template.indexOf(pattern) > -1) {
            template = template.replace(pattern,opts[key]);
        }
    });
    return template;
}

function get_node_abi(runtime, target) {
    if (target) {
        // abi_crosswalk generated with ./scripts/abi_crosswalk.js
        var abi = '';
        if (runtime === 'node-webkit') {
            var node_version = nw_crosswalk[target];
            if (!node_version) {
                throw new Error("node-webkit version '"+target+"' not supported");
            }
            abi = abi_crosswalk[node_version].node_abi;
        } else {
            abi = abi_crosswalk[target].node_abi;
        }
        if (!abi) {
            throw new Error("Unsupported target version: " + target);
        }
        if (abi > 1) {
            return runtime+'-v' + (+abi);
        } else {
            // no support for node-webkit unless > 0.10.x
            if (runtime != 'node') {
                throw new Error("Runtime '" + runtime + "' unsupported for target version: " + target);
            }
            abi = abi_crosswalk[target].v8;
            return 'v8-' + abi;
        }
    } else {
        // process.versions.modules added in >= v0.10.4 and v0.11.7
        // https://github.com/joyent/node/commit/ccabd4a6fa8a6eb79d29bc3bbe9fe2b6531c2d8e
        return process.versions.modules ? runtime+'-v' + (+process.versions.modules) :
               'v8-' + process.versions.v8.split('.').slice(0,2).join('.');
    }
}

function validate_config(package_json,callback) {
    var msg = package_json.name + ' package.json is not node-pre-gyp ready:\n';
    if (!package_json.main) {
        return callback(new Error(msg+"package.json must declare 'main'"));
    }
    if (!package_json.binary) {
        return callback(new Error(msg+"package.json must declare 'binary' property.\nSee https://github.com/springmeyer/node-pre-gyp#design for details\n"));
    }
    var o = package_json.binary;
    if (!o.module_path) {
        return callback(new Error(msg+"package.json must declare 'binary.module_path'"));
    }
    if (!o.module_name) {
        return callback(new Error(msg+"package.json must declare 'binary.module_name'"));
    }
    if (!o.template) {
        return callback(new Error(msg+"package.json must declare 'binary.template'"));
    }
    if (!o.remote_uri) {
        return callback(new Error(msg+"package.json must declare 'binary.remote_uri'"));
    }
    // enforce `remote_uri` as https
    var protocol = url.parse(o.remote_uri).protocol;
    if (protocol !== 'https:') {
        return callback(new Error("'remote_uri' protocol ("+protocol+") is invalid - only 'https:' is accepted"));
    }
    return callback();
};

module.exports.validate_config = validate_config;

module.exports.evaluate = function(package_json,options,callback) {
    validate_config(package_json,function(err) {
        if (err) return callback(err);
        var v = package_json.version;
        var module_version = semver.parse(v);
        var runtime = options.runtime || 'node';
        var opts = {
            configuration: (options.debug === true) ? 'Debug' : 'Release'
            , module_name: package_json.binary.module_name
            , version: module_version.version
            , prerelease: module_version.prerelease.length ? v.slice(v.indexOf(module_version.prerelease[0])) : ''
            , major: module_version.major
            , minor: module_version.minor
            , patch: module_version.patch
            , runtime: runtime
            , node_abi: get_node_abi(runtime,options.target)
            , target: options.target || ''
            , platform: options.target_platform || process.platform
            , arch: options.target_arch || process.arch
            , target_arch: options.target_arch || process.arch
            , module_main: package_json.main
        }
        opts.versioned = eval_template(package_json.binary.template,opts);
        return callback(null,opts);
    });
}
