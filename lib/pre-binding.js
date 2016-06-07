"use strict";

var versioning = require('../lib/util/versioning.js');
var fs = require('fs');
var path = require('path');

var fileExistsSync = function(file_path) {
   try {
      return fs.statSync(file_path).isFile();
   }
   catch (err) {
      return false;
   }
};

module.exports = exports;

exports.usage = 'Finds the require path for the node-pre-gyp installed module';

exports.validate = function(package_json) {
    versioning.validate_config(package_json);
};

exports.find = function(package_json_path,opts) {
   if (!fileExistsSync(package_json_path)) {
        throw new Error("package.json does not exist at " + package_json_path);
   }
   var package_json = require(package_json_path);
   versioning.validate_config(package_json);
   opts = opts || {};
   if (!opts.module_root) opts.module_root = path.dirname(package_json_path);
   var meta = versioning.evaluate(package_json,opts);
   return meta.module;
};
