'use strict';

const s3_setup = require('../lib/util/s3_setup.js');
const test = require('tape');

test('should propertly detect s3 bucket and prefix', (t) => {
  const url = 'https://bucket-with-dashes.s3-us-west-1.amazonaws.com';
  const result = {};
  s3_setup.detect(url, result);
  t.equal(result.prefix, '');
  t.equal(result.bucket, 'bucket-with-dashes');
  t.equal(result.region, 'us-west-1');
  t.end();
});

test('should propertly detect s3 bucket and prefix with dots', (t) => {
  const url = 'https://bucket.with.dots.s3.amazonaws.com/prefix';
  const result = {};
  s3_setup.detect(url, result);
  t.equal(result.prefix, 'prefix');
  t.equal(result.bucket, 'bucket.with.dots');
  t.equal(result.region, 'us-east-1');
  t.end();
});

test('should propertly detect modern s3 bucket and prefix', (t) => {
  const url = 'https://bucket-name.s3.us-east-1.amazonaws.com';
  const result = {};
  s3_setup.detect(url, result);
  t.equal(result.prefix, '');
  t.equal(result.bucket, 'bucket-name');
  t.equal(result.region, 'us-east-1');
  t.end();
});
