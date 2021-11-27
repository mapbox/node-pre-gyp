var binary = require('node-pre-gyp');
var path = require('path')
var binding_path = binary.find(path.resolve(path.join(__dirname,'./package.json')));
var binding = require(binding_path);

require('assert').equal(binding.hello(),"hello");

var binding_path_using_package_json = binary.findUsingPackageJson(require('./package.json'));
var binding_using_package_json = require('./' + path.join(
  binding_path_using_package_json.module_relative_path, 
  binding_path_using_package_json.module_name
) + '.node');

require('assert').equal(binding_using_package_json.hello(),"hello");