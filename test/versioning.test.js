"use strict";

var path = require('path');
var versioning = require('../lib/util/versioning.js');
var assert = require('assert');
var jsEngine = process.jsEngine === 'chakracore' ? '-' + process.jsEngine : '';
var protocol = /^win/.test(process.platform) ? 'http' : 'https';

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
                "host"        : protocol + "://node-pre-gyp-tests.s3-us-west-1.amazonaws.com"
            }
        };
        var opts = versioning.evaluate(mock_package_json, {});
        assert.equal(opts.remote_path,"./test/v0.1.0/Release/0.1.0/");
        // Node v0.11.x on windows lowercases C:// when path.join is called
        // https://github.com/joyent/node/issues/7031
        assert.equal(path.normalize(opts.module_path),path.join(process.cwd(),"lib/binding/Release/test"));
        var opts_toolset = versioning.evaluate(mock_package_json, {toolset:"custom-toolset"});
        assert.equal(opts_toolset.remote_path,"./test/v0.1.0/Release/0.1.0/custom-toolset/");
    });

    it('should detect abi for node process', function() {
        var mock_process_versions = {
            node: '0.10.33',
            v8: '3.14.5.9',
            modules: '11',
        };
        var abi = versioning.get_node_abi('node',mock_process_versions);
        assert.equal(abi,'node-v11' + jsEngine);
        assert.equal(versioning.get_runtime_abi('node',undefined),versioning.get_node_abi('node',process.versions));
    });

    it('should detect abi for odd node target', function() {
        var mock_process_versions = {
            node: '0.11.1000000',
            modules: 'bogus',
        };
        var abi = versioning.get_node_abi('node',mock_process_versions);
        assert.equal(abi,'node-v0.11.1000000');
    });

    it('should detect abi for custom node target', function() {
        var mock_process_versions = {
            "node": (jsEngine) ? '8.1.2' : '0.10.0',
            "modules": (jsEngine) ? '57' : '11',
        };
        
        if (jsEngine) {
            assert.equal(versioning.get_runtime_abi('node','8.1.2'),versioning.get_node_abi('node',mock_process_versions));
        } else {
            assert.equal(versioning.get_runtime_abi('node','0.10.0'),versioning.get_node_abi('node',mock_process_versions));
        }
       
        if (!jsEngine) {
            var mock_process_versions2 = {
                "node": '0.8.0',
                "v8": "3.11"
            };
            assert.equal(versioning.get_runtime_abi('node','0.8.0'),versioning.get_node_abi('node',mock_process_versions2));
        }
    });

    it('should detect runtime for node-webkit and electron', function() {
        var mock_process_versions = {
            "electron": '0.37.3',
        };
        assert.equal(versioning.get_process_runtime(mock_process_versions),'electron');
        var mock_process_versions2 = {
            "node": '0.8.0',
        };
        assert.equal(versioning.get_process_runtime(mock_process_versions2),'node');
        var mock_process_versions3 = {
            "node-webkit": '0.37.3',
        };
        assert.equal(versioning.get_process_runtime(mock_process_versions3),'node-webkit');
    });

    it('should detect abi for electron runtime', function() {
        assert.equal(versioning.get_runtime_abi('electron','0.37.3'),versioning.get_electron_abi('electron','0.37.3'));
    });

    it('should detect abi for node-webkit runtime', function() {
        assert.equal(versioning.get_runtime_abi('node-webkit','0.10.5'),versioning.get_node_webkit_abi('node-webkit','0.10.5'));
    });

    it('should detect custom binary host from env', function() {
        var mock_package_json = {
            "name"   : "test",
            "main"   : "test.js",
            "version": "0.1.0",
            "binary" : {
                "module_name" : "test",
                "module_path" : "./lib/binding/{configuration}/{toolset}/{name}",
                "remote_path" : "./{name}/v{version}/{configuration}/{version}/{toolset}/",
                "package_name": "{module_name}-v{major}.{minor}.{patch}-{prerelease}+{build}-{toolset}-{node_abi}-{platform}-{arch}.tar.gz",
                "host"        : protocol + "://node-pre-gyp-tests.s3-us-west-1.amazonaws.com"
            }
        };
        // mock npm_config_test_binary_host_mirror env
        process.env.npm_config_test_binary_host_mirror = protocol + '://npm.taobao.org/mirrors/node-inspector/';
        var opts = versioning.evaluate(mock_package_json, {});
        assert.equal(opts.host, protocol + '://npm.taobao.org/mirrors/node-inspector/');
        delete process.env.npm_config_test_binary_host_mirror;
    });

});
