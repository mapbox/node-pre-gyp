
module.exports = exports = package

exports.usage = 'Packs binary (and enclosing directory) into locally staged tarball'

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
    var opts = versioning.evaluate(package_json, gyp.opts);
    var from = opts.module_path;
    var binary_module = path.join(from,opts.module_name + '.node');
    existsAsync(binary_module,function(found) {
        if (!found) {
            return callback(new Error("Cannot package because " + binary_module + " missing: run `node-pre-gyp rebuild` first"))
        }
        var tarball = opts.staged_tarball;
        var basedir = path.basename(from);
        var filter_func = function (entry) {
            console.log('['+package_json.name+'] packing ' + entry.path);
            return true;
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
}
