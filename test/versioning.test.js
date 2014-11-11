var path = require('path');
var versioning = require('../lib/util/versioning.js');
var assert = require('assert');

describe('versioning', function() {
    it('should normalize double slash', function() {
        var mock_package_json = {
            "name"   : "test",
            "main"   : "test.js",
            "version": "0.1.0",
            "binary" : {
                "module_name" : "test",
                "module_path" : "./lib/binding/{configuration}/{toolset}/{name}",
                "remote_path" : "./{name}/v{version}/{configuration}/{version}/{toolset}/",
                "package_name": "{module_name}-v{major}.{minor}.{patch}-{prerelease}+{build}-{toolset}-{node_abi}-{platform}-{arch}.tar.gz",
                "host"        : "https://node-pre-gyp-tests.s3-us-west-1.amazonaws.com"                
            }
        }
        var opts = versioning.evaluate(mock_package_json, {});
        assert.equal(opts.remote_path,"test/v0.1.0/Release/0.1.0/");
        assert.equal(opts.module_path,path.join(process.cwd(),"lib/binding/Release/test"));
    });
});
