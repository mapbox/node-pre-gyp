
module.exports = exports;

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

function validate_config(package_json,callback) {
    var msg = package_json.name + ' package is not node-pre-gyp ready:\n';
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
    return callback();
};

module.exports.validate_config = validate_config;

module.exports.evaluate = function(package_json,options,callback) {
    validate_config(package_json,function(err) {
        if (err) return callback(err);
        var v = package_json.version;
        var module_version = semver.parse(v);
        var opts = {
            configuration: (options.debug === true) ? 'Debug' : 'Release'
            , module_name: package_json.binary.module_name
            , version: module_version.version
            , prerelease: module_version.prerelease.length ? v.slice(v.indexOf(module_version.prerelease[0])) : ''
            , major: module_version.major
            , minor: module_version.minor
            , patch: module_version.patch
            , node_abi: get_node_abi()
            , platform: process.platform
            , arch: process.arch
            , target_arch: options.target_arch || process.arch
            , module_main: package_json.main
        }
        opts.versioned = eval_template(package_json.binary.template,opts);
        return callback(null,opts);
    });
}
