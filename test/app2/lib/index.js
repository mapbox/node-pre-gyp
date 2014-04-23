var binary = require('node-pre-gyp');
var path = require('path')
var package_json_path = path.resolve(path.join(__dirname,'../package.json'));
var binding_release_path = binary.find(package_json_path);
var binding_debug_path = binary.find(package_json_path,{debug:true});
try {
    var binding = require(binding_debug_path);
    console.log('Loaded Debug build from',binding_debug_path);
} catch (err) {
    var binding = require(binding_release_path);
    console.log('Loaded Release build from',binding_release_path);
}

require('assert').equal(binding.hello(),"hello");