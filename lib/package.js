
module.exports = exports = package

exports.usage = 'Publishes pre-built binary'

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
  , write = require('fs').createWriteStream
  , pack = require('tar-pack').pack
  , mkdirp = require('mkdirp')

function package(gyp, argv, callback) {
    // @TODO - respect -C/--directory
    var package_json = JSON.parse(fs.readFileSync('./package.json'));
    var command_line_opts = (typeof(gyp.opts.argv.original) === 'string') ? JSON.parse(gyp.opts.argv).original : gyp.opts.argv.original || [];
    command_line_opts = command_line_opts.filter(function(opt) { return opt.length > 2 && opt.slice(0,2) == '--'});
    var node_gyp_args = ['rebuild'].concat(command_line_opts);
    function afterTarball(err) {
        if (err) return callback(err);
        log.verbose('tarball', 'done creating tarball')
        callback();
    }
    versioning.evaluate(package_json, gyp.opts, function(err,opts) {
        if (err) return callback(err);
        compile.run_gyp(node_gyp_args,opts,function(err,opts) {
            if (err) return callback(err);
            var staging = path.join('stage',opts.versioned);
            var basedir = path.basename(package_json.binary.module_path);
            var filter_func = function (entry) {
                return ((entry.type == 'Directory' && entry.basename == basedir) ||
                        path.extname(entry.basename) == '.node');
            }
            var packer = pack(package_json.binary.module_path, { filter: filter_func });
            packer.on('error', function (err) {
                return callback(err);
            })
            packer.on('close', function () {
                log.info('install','Binary staged at "'+staging + '"');
                return callback();
            })
            mkdirp(path.dirname(staging),function(err) {
                packer.pipe(write(staging));
            });
        })
    });
}
