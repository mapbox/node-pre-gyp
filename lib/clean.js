
module.exports = exports = clean

exports.usage = 'Removes the generated .node module'

var fs = require('fs')
  , rm = require('rimraf')
  , path = require('path')
  , exists = require('fs').exists || require('path').exists
  , log = require('npmlog')
  , versioning = require('./util/versioning.js')

function clean (gyp, argv, callback) {
    var package_json = JSON.parse(fs.readFileSync('./package.json'));
    var opts = versioning.evaluate(package_json, gyp.opts);
    exists(opts.versioned_path,function(found) {
      if (found) {
        console.log('Removing "%s"', opts.versioned_path)
        return rm(opts.versioned_path, callback);
      }
      return callback();
    })
}
