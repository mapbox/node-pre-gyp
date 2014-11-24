
module.exports = exports = package;

exports.usage = 'Packs binary (and enclosing directory) into locally staged tarball';

var fs = require('fs'),
    path = require('path'),
    log = require('npmlog'),
    versioning = require('./util/versioning.js'),
    compile = require('./util/compile.js'),
    write = require('fs').createWriteStream,
    pack = require('tar-pack').pack,
    existsAsync = fs.exists || path.exists,
    existsSync = fs.existsSync,
    mkdirp = require('mkdirp');

function package(gyp, argv, callback) {
    var package_json = JSON.parse(fs.readFileSync('./package.json'));
    var opts = versioning.evaluate(package_json, gyp.opts);
    var from = opts.module_path;
    var binary_module = path.join(from,opts.module_name + '.node');
    var targets = package_json.binary.targets;

    var packageTargets = function(binaries) {
      var tarball = opts.staged_tarball;
      var basedir = path.basename(from);

      var filter_func = function (entry) {
          // ensure directories are +x
          // https://github.com/mapnik/node-mapnik/issues/262
          log.info('package','packing ' + entry.path);
          return true;
      };

      mkdirp(path.dirname(tarball),function(err) {
        pack(from, { filter: filter_func })
         .pipe(write(tarball))
         .on('error', function (err) {
            if (err)  console.error('['+package_json.name+'] ' + err.message);
            return callback(err);
         })
         .on('close', function () {
            log.info('package','Binary staged at "' + tarball + '"');
            return callback();
         });
      });
    };

    existsAsync(binary_module, function(found) {
      if (!found) {
        var allTargetsFound = null;

        if  (!!targets) {
          allTargetsFound = targets.map(function(target) {
            var targetPath = path.join(from, target + '.node');
            return existsSync(targetPath);
          });
        }

        if (Array.isArray(allTargetsFound) && (allTargetsFound.indexOf(false) == -1)) {
          packageTargets();
        } else {
          return callback(new Error("Cannot package because " + binary_module + " or targets missing: run `node-pre-gyp rebuild` first"));
        }
      } else {
        packageTargets();
      }

    });
}
