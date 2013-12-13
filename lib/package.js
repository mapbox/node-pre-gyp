
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
    function afterTarball(err) {
        if (err) return callback(err);
        log.verbose('tarball', 'done creating tarball')
        callback();
    }
    versioning.evaluate(package_json, gyp.opts, function(err,opts) {
        if (err) return callback(err);
        compile.run_gyp(['rebuild'],opts,function(err,opts) {
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
