var path = require('path');
var pkg = require('./package.json');
var assert = require('assert');
var binding = './' + path.join(pkg.binary.module_path,pkg.binary.module_name + '.node');
var app = require(binding);

assert.ok(app);
assert.equal(app.hello(),"hello");