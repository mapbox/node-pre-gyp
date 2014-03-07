
module.exports = exports = testpackage

exports.usage = 'Tests that the staged package is valid'

var fs = require('fs')
  , path = require('path')
  , log = require('npmlog')
  , existsAsync = fs.exists || path.exists
  , versioning = require('./util/versioning.js')
  , test_binary = require('./util/test_binary.js')
  , read = require('fs').createReadStream
  , unpack = require('tar-pack').unpack

function testpackage(gyp, argv, callback) {
    var package_json = JSON.parse(fs.readFileSync('./package.json'));
    var opts = versioning.evaluate(package_json, gyp.opts);
    var tarball = opts.staged_tarball;
    existsAsync(tarball, function(found) {
        if (!found) {
            return callback(new Error("Cannot test package because " + tarball + " missing: run `node-pre-gyp package` first"))
        }
        var to = opts.module_path;
        existsAsync(to, function(found) {
          read(tarball).pipe(unpack(to, function (err) {
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
    });
}
