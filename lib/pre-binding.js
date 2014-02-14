var fs = require('fs');
var versioning = require('../lib/util/versioning.js')
var existsSync = require('fs').existsSync || require('path').existsSync;
var path = require('path');

module.exports = exports;

exports.validate = function(package_json) {
    versioning.validate_config(package_json);
}

exports.find = function(package_json_path) {
   if (!existsSync(package_json_path)) {
        throw new Error("package.json does not exist at "+package_json_path);
   }
   var package_json = require(package_json_path);
   versioning.validate_config(package_json);
   var meta = versioning.evaluate(package_json);
   var module_root = path.dirname(package_json_path);
   return path.join(module_root,meta.versioned_path,meta.module_name + '.node');
}
