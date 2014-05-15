
module.exports = exports;

var path = require('path')
  , semver = require('semver')
  , url = require('url')
  , abi_crosswalk = require('./abi_crosswalk.json')
  , nw_crosswalk = require('./nw_crosswalk.json')


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
            if (abi_crosswalk[target]) {
                abi = abi_crosswalk[target].node_abi;
            }
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
            if (!abi_crosswalk[target]) {
                throw new Error("Unsupported target version: " + target);
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

var required_parameters = [
    'module_name',
    'module_path',
    'host'
];

function validate_config(package_json,callback) {
    var msg = package_json.name + ' package.json is not node-pre-gyp ready:\n';
    var missing = [];
    if (!package_json.main) {
        missing.push('main');
    }
    if (!package_json.name) {
        missing.push('name');
    }
    if (!package_json.binary) {
        missing.push('binary');
    }
    var o = package_json.binary;
    required_parameters.forEach(function(p) {
        if (missing.indexOf('binary') > -1) {
            missing.pop('binary');
        }
        if (!o || o[p] == undefined) {
            missing.push('binary.' + p);
        }
    });
    if (missing.length >= 1) {
        throw new Error(msg+"package.json must declare these properties: \n" + missing.join('\n'));
    }
    if (o) {
        // enforce https over http
        var protocol = url.parse(o.host).protocol;
        if (protocol === 'http:') {
            throw new Error("'host' protocol ("+protocol+") is invalid - only 'https:' is accepted");
        }
    }
};

module.exports.validate_config = validate_config;

function eval_template(template,opts) {
    Object.keys(opts).forEach(function(key) {
        var pattern = '{'+key+'}';
        while (template.indexOf(pattern) > -1) {
            template = template.replace(pattern,opts[key]);
        }
    });
    return template;
}

// url.resolve needs single trailing slash
// to behave correctly, otherwise a double slash
// may end up in the url which breaks requests
// and a lacking slash may not lead to proper joining
function add_trailing_slash(pathname) {
    if (pathname.slice(-1) != '/') {
        return pathname + '/';
    }
    return pathname;
}

var default_package_name = '{module_name}-v{version}-{node_abi}-{platform}-{arch}.tar.gz';
var default_remote_path = '';

module.exports.evaluate = function(package_json,options) {
    options = options || {};
    validate_config(package_json);
    var v = package_json.version;
    var module_version = semver.parse(v);
    var runtime = options.runtime || (process.versions['node-webkit'] ? 'node-webkit' : 'node');
    options.debug = Boolean(options.debug);
    var opts = {
          name: package_json.name
        , configuration: options.debug ? 'Debug' : 'Release'
        , debug: options.debug
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
    opts.host = add_trailing_slash(eval_template(package_json.binary.host,opts));
    opts.module_path = eval_template(package_json.binary.module_path,opts);
    // now we resolve the module_path to ensure it is absolute so that binding.gyp variables work predictably
    if (options.module_root) {
        // resolve relative to known module root: works for pre-binding require
        opts.module_path = path.join(options.module_root,opts.module_path);
    } else {
        // resolve relative to current working directory: works for node-pre-gyp commands
        opts.module_path = path.resolve(opts.module_path);
    }
    opts.remote_path = package_json.binary.remote_path ? add_trailing_slash(eval_template(package_json.binary.remote_path,opts)) : default_remote_path;
    var package_name = package_json.binary.package_name ? package_json.binary.package_name : default_package_name;
    opts.package_name = eval_template(package_name,opts);
    opts.staged_tarball = path.join('build/stage',opts.remote_path,opts.package_name);
    opts.hosted_path = url.resolve(opts.host,opts.remote_path);
    opts.hosted_tarball = url.resolve(opts.hosted_path,opts.package_name);
    return opts;
}
