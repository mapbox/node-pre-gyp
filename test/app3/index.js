var path = require('path');
var pkg = require('./package.json');
var assert = require('assert');
var module_path = path.join(
     path.join(__dirname,pkg.binary.module_path),
     pkg.binary.module_name + '.node');
var binding = require(module_path);

assert.ok(binding);
assert.equal(binding.hello(),"hello");