
module.exports = exports = testpackage

exports.usage = 'Tests that staged package is valid'

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
  , existsSync = fs.existsSync || path.existsSync
  , cp = require('child_process')
  , versioning = require('./util/versioning.js')
  , compile = require('./util/compile.js')
  , test_binary = require('./util/test_binary.js')
  , read = require('fs').createReadStream
  , unpack = require('tar-pack').unpack

function testpackage(gyp, argv, callback) {
    var package_json = JSON.parse(fs.readFileSync('./package.json'));
    versioning.evaluate(package_json, gyp.opts, function(err,opts) {
        if (err) return callback(err);
        var tarball = path.join('build/stage',opts.versioned);
        var to = package_json.binary.module_path;
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
                        console.log("Package appears valid");
                        return callback();                        
                    }
                });
              }))
        });
    });
}
