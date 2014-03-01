
module.exports = exports = testpackage

exports.usage = 'Tests that staged package is valid'

var fs = require('fs')
  , path = require('path')
  , log = require('npmlog')
  , existsAsync = fs.exists || path.exists
  , existsSync = fs.existsSync || path.existsSync
  , versioning = require('./util/versioning.js')
  , test_binary = require('./util/test_binary.js')
  , read = require('fs').createReadStream
  , unpack = require('tar-pack').unpack

function testpackage(gyp, argv, callback) {
    var package_json = JSON.parse(fs.readFileSync('./package.json'));
    var opts = versioning.evaluate(package_json, gyp.opts);
    var tarball = path.join('build/stage',opts.versioned_tarball);
    var to = opts.versioned_path;
    if (existsSync(to) && !gyp.opts['overwrite']) {
        return callback(new Error('WARNING: ' + to + ' already exists and will be overwritten: pass --overwrite to confirm'));
    }
    existsAsync(tarball,function(found) {
        if (!found) {
            return callback(new Error("Cannot test package because " + tarball + " missing: run `node-pre-gyp package` first"))
        }
        read(tarball)
          .pipe(unpack(to, function (err) {
            if (err) return callback(err);
            test_binary.validate(opts,function(err) {
                if (err) {
                    return callback(err);
                } else {
                    console.log('['+package_json.name+'] Package appears valid');
                    return callback();
                }
            });
          }))
    });
}
