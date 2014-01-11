
module.exports = exports = package

exports.usage = 'Packs binary into tarball'

var fs = require('fs')
  , path = require('path')
  , log = require('npmlog')
  , versioning = require('./util/versioning.js')
  , compile = require('./util/compile.js')
  , write = require('fs').createWriteStream
  , pack = require('tar-pack').pack
  , existsAsync = fs.exists || path.exists
  , mkdirp = require('mkdirp');

function package(gyp, argv, callback) {
    var package_json = JSON.parse(fs.readFileSync('./package.json'));
    versioning.evaluate(package_json, gyp.opts, function(err,opts) {
        if (err) return callback(err);
        var from = package_json.binary.module_path;
        var binary_module = path.join(from,opts.module_name + '.node');
        existsAsync(binary_module,function(found) {
            if (!found) {
                return callback(new Error("Cannot package because " + binary_module + " missing: run `node-pre-gyp rebuild` first"))
            }
            var tarball = path.join('build/stage',opts.versioned);
            var basedir = path.basename(from);
            var filter_func = function (entry) {
                return ((entry.type == 'Directory' && entry.basename == basedir) ||
                        path.extname(entry.basename) == '.node');
            }
            mkdirp(path.dirname(tarball),function(err) {
                pack(from, { filter: filter_func })
                 .pipe(write(tarball))
                 .on('error', function (err) {
                    return callback(err);
                 })
                 .on('close', function () {
                    log.info('install','Binary staged at "' + tarball + '"');
                    return callback();
                 })
            });
        });
    });
}
