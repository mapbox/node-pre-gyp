"use strict";

var s3_setup = require('../lib/util/s3_setup.js');
var test = require('tape');

test('should propertly detect s3 bucket and prefix', function(t) {
    var url = "https://node-pre-gyp-tests.s3-us-west-1.amazonaws.com";
    var result = {};
    s3_setup.detect(url, result);
    t.equal(result.prefix,'');
    t.equal(result.bucket,'node-pre-gyp-tests');
    t.end();
});

test('should propertly detect s3 bucket and prefix with dots', function(t) {
    var url = "https://bucket.with.dots.s3.amazonaws.com/prefix";
    var result = {};
    s3_setup.detect(url, result);
    t.equal(result.prefix,'prefix');
    t.equal(result.bucket,'bucket.with.dots');
    t.end();
});
