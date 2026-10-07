'use strict';

const s3_setup = require('../lib/util/s3_setup.js');
const test = require('tape');

test('should properly detect virtual host s3 bucket', (t) => {
  const opts = {
    hosted_path: 'https://bucket-name.s3.us-west-2.amazonaws.com'
  };
  const result = s3_setup.detect(opts);
  t.equal(result.prefix, '');
  t.equal(result.bucket, 'bucket-name');
  t.equal(result.region, 'us-west-2');
  t.end();
});

test('should properly detect virtual host s3 bucket and prefix', (t) => {
  const opts = {
    hosted_path: 'https://bucket-name.s3.us-west-2.amazonaws.com/prefix'
  };
  const result = s3_setup.detect(opts);
  t.equal(result.prefix, 'prefix');
  t.equal(result.bucket, 'bucket-name');
  t.equal(result.region, 'us-west-2');
  t.end();
});

test('should properly detect virtual host s3 bucket with legacy dash format', (t) => {
  const opts = {
    hosted_path: 'https://bucket-name.s3-us-west-2.amazonaws.com'
  };
  const result = s3_setup.detect(opts);
  t.equal(result.prefix, '');
  t.equal(result.bucket, 'bucket-name');
  t.equal(result.region, 'us-west-2');
  t.end();
});

test('should properly detect virtual host s3 bucket with legacy dash format and prefix', (t) => {
  const opts = {
    hosted_path: 'https://bucket-name.s3-us-west-2.amazonaws.com/prefix'
  };
  const result = s3_setup.detect(opts);
  t.equal(result.prefix, 'prefix');
  t.equal(result.bucket, 'bucket-name');
  t.equal(result.region, 'us-west-2');
  t.end();
});


test('should properly detect s3 bucket with dashes', (t) => {
  const opts = {
    hosted_path: 'https://bucket-with-dashes.s3-us-west-1.amazonaws.com'
  };
  const result = s3_setup.detect(opts);
  t.equal(result.prefix, '');
  t.equal(result.bucket, 'bucket-with-dashes');
  t.equal(result.region, 'us-west-1');
  t.end();
});

test('should properly detect s3 bucket with dots', (t) => {
  const opts = {
    hosted_path: 'https://bucket.with.dots.s3-us-west-1.amazonaws.com'
  };
  const result = s3_setup.detect(opts);
  t.equal(result.prefix, '');
  t.equal(result.bucket, 'bucket.with.dots');
  t.equal(result.region, 'us-west-1');
  t.end();
});

test('should properly default to us-east-1 when no region provided (legacy standard region)', (t) => {
  const opts = {
    hosted_path: 'https://bucket-name.s3.amazonaws.com'
  };
  const result = s3_setup.detect(opts);
  t.equal(result.prefix, '');
  t.equal(result.bucket, 'bucket-name');
  t.equal(result.region, 'us-east-1');
  t.end();
});

test('should properly detect compatible s3 bucket', (t) => {
  const opts = {
    hosted_path: 'https://storage.com',
    host: 'https://storage.com',
    bucket: 'bucket-name',
    region: 'us-east-1'
  };
  const result = s3_setup.detect(opts);
  t.equal(result.prefix, '');
  t.equal(result.bucket, 'bucket-name');
  t.equal(result.region, 'us-east-1');
  t.equal(result.endpoint, 'https://storage.com');
  t.end();
});

test('should properly detect compatible s3 bucket with path style url', (t) => {
  const opts = {
    hosted_path: 'https://storage.com/bucket-name/', // set by versioning from package.json definitions with trailing slash
    host: 'https://storage.com',
    bucket: 'bucket-name',
    region: 'us-east-1',
    s3ForcePathStyle: true
  };
  const result = s3_setup.detect(opts);
  t.equal(result.prefix, ''); // bucket name should be removed from prefix
  t.equal(result.bucket, 'bucket-name');
  t.equal(result.region, 'us-east-1');
  t.equal(result.endpoint, 'https://storage.com');
  t.end();
});

test('should properly detect compatible s3 bucket with path style url', (t) => {
  const opts = {
    hosted_path: 'https://storage.com', // set by versioning from package.json definitions
    host: 'https://storage.com',
    bucket: 'bucket-name',
    region: 'us-east-1',
    s3ForcePathStyle: false
  };
  const result = s3_setup.detect(opts);
  t.equal(result.prefix, ''); // bucket name should be removed from prefix
  t.equal(result.bucket, 'bucket-name');
  t.equal(result.region, 'us-east-1');
  t.equal(result.endpoint, 'https://storage.com');
  t.end();
});

test('should error trying to parse invalid s3 url (path style)', (t) => {
  const opts = {
    hosted_path: 'https://s3.us-west-2.amazonaws.com/mybucket/' // no bucket name
  };
  let result = {};
  try {
    result = s3_setup.detect(opts);
  } catch (e) {
    const expectedMessage = 'Could not parse s3 bucket name from virtual host url.';
    t.equal(e.message, expectedMessage);
  }

  t.equal(result.prefix, undefined);
  t.equal(result.bucket, undefined);
  t.equal(result.region, undefined);
  t.end();
});

test('should error trying to parse invalid s3 url (not s3)', (t) => {
  const opts = {
    hosted_path: 'https://storage.com' // domain url without bucket/region defined
  };
  let result = {};
  try {
    result = s3_setup.detect(opts);
  } catch (e) {
    const expectedMessage = 'Could not parse s3 bucket name from virtual host url.';
    t.equal(e.message, expectedMessage);
  }

  t.equal(result.prefix, undefined);
  t.equal(result.bucket, undefined);
  t.equal(result.region, undefined);
  t.end();
});

test('should error trying to parse invalid s3 when using miss-configured compatible host (no bucket name)', (t) => {
  const opts = {
    host: 'https://storage.com',
    hosted_path: 'https://storage.com',
    region: 'us-east-1'
  };
  let result = {};
  try {
    result = s3_setup.detect(opts);
  } catch (e) {
    const expectedMessage = 'Could not parse s3 bucket name from virtual host url.';
    t.equal(e.message, expectedMessage);
  }

  t.equal(result.prefix, undefined);
  t.equal(result.bucket, undefined);
  t.equal(result.region, undefined);
  t.end();
});

test('should error trying to parse invalid s3 when using miss-configured compatible host (no region name)', (t) => {
  const opts = {
    host: 'https://storage.com',
    hosted_path: 'https://storage.com',
    bucket: 'bucket-name'
  };
  let result = {};
  try {
    result = s3_setup.detect(opts);
  } catch (e) {
    const expectedMessage = 'Could not parse s3 bucket name from virtual host url.';
    t.equal(e.message, expectedMessage);
  }

  t.equal(result.prefix, undefined);
  t.equal(result.bucket, undefined);
  t.equal(result.region, undefined);
  t.end();
});
