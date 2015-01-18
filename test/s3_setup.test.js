"use strict";

var s3_setup = require('../lib/util/s3_setup.js');
var assert = require('assert');

describe('s3_setup', function() {
    it('should propertly detect s3 bucket and prefix', function() {
        var url = "https://node-pre-gyp-tests.s3-us-west-1.amazonaws.com";
        var result = {};
        s3_setup.detect(url, result);
        assert.equal(result.prefix,'');
        assert.equal(result.bucket,'node-pre-gyp-tests');
    });

    it('should propertly detect s3 bucket and prefix with dots', function() {
        var url = "https://bucket.with.dots.s3.amazonaws.com/prefix";
        var result = {};
        s3_setup.detect(url, result);
        assert.equal(result.prefix,'prefix');
        assert.equal(result.bucket,'bucket.with.dots');
    });
});
