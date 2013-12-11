
module.exports = exports = publish

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

function publish(gyp, argv, callback) {
    // @TODO - respect -C/--directory
    var package_json = JSON.parse(fs.readFileSync('./package.json'));
    if (gyp.opts['build-from-source']
        && (gyp.opts['build-from-source'] === true 
            || gyp.opts['build-from-source'] === package_json.name)) {
        return compile(['rebuild'],callback);
    }
    function afterTarball(err) {
        if (err) return callback(err);
        log.verbose('tarball', 'done creating tarball')
        callback();
    }
    versioning.evaluate(package_json, gyp.opts, function(err,opts) {
        if (err) return callback(err);
        //compile.run_gyp(['rebuild'],function(err) {
            if (err) return callback(err);
            var staging = path.join('stage',opts.versioned);
            var filter_func = function (entry) { 
                //console.log(entry);
                return entry.type == 'Directory' || path.extname(entry.basename) == '.node';
            }
            var opts = {filter:filter_func}
            pack(package_json.binary.module_path,opts).pipe(write(staging))
            .on('error', function (err) {
              console.error(err.stack)
            })
            .on('close', function () {
              console.log('done')
            })
            console.log(opts.versioned);
        //})
        return callback();
    });
}
