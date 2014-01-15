
module.exports = exports = clean

exports.usage = 'Removes the generated .node module'

var fs = require('fs')
  , rm = require('rimraf')
  , path = require('path')
  , log = require('npmlog')
  , versioning = require('./util/versioning.js')

function clean (gyp, argv, callback) {
    var package_json = JSON.parse(fs.readFileSync('./package.json'));
    versioning.evaluate(package_json, gyp.opts, function(err,opts) {
        if (err) return callback(err);
        var to = package_json.binary.module_path;
        var binary_module = path.join(to,opts.module_name + '.node');
        console.log('Removing "%s"', binary_module)
        rm(binary_module, callback);
    });
}
