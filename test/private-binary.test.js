'use strict';

const fs = require('fs');
const test = require('tape');
const nock = require('nock');
const install = require('../lib/install.js');

// Dummy tar.gz data - contains a blank directory
const targz = 'H4sICPr8u1oCA3gudGFyANPTZ6A5MDAwMDc1VQDTZhAaCGA0hGNobGRqZm5uZmxupGBgaGhiZsKgYMpAB1BaXJJYBHRKYk5pcioedeUZqak5+D2J5CkFhlEwCkbBKBjkAAAyG1ofAAYAAA==';

test('should fallback to authenticated download on 403 Forbidden', (t) => {
  process.env.node_pre_gyp_mock_s3 = 'true';
  process.env.AWS_ACCESS_KEY_ID = 'mock-key';
  process.env.AWS_SECRET_ACCESS_KEY = 'mock-secret';

  const origin = 'https://npg-mock-bucket.s3.us-east-1.amazonaws.com';
  nock.cleanAll();

  // Mock the public HTTPS request to return 403
  const publicScope = nock(origin)
    .get(/\/node-pre-gyp\/node-pre-gyp-test-app1\/v0.1.0\/Release\/node-v\d+-\S+.tar.gz/)
    .reply(403, 'Forbidden');

  const opts = {
    opts: {
      'build-from-source': false,
      'update-binary': true
    }
  };

  process.chdir('test/app1');
  opts.package_json = JSON.parse(fs.readFileSync('./package.json'));
  opts.package_json.binary.host = origin;

  install(opts, [], (err) => {
    delete process.env.node_pre_gyp_mock_s3;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;

    t.ok(publicScope.isDone(), 'Public HTTPS request was attempted');
    if (err) {
      t.ok(err.message.includes('does not exist') || err.message.includes('NotFound'),
        'Error should be about missing file in S3, not credentials');
    } else {
      t.pass('Authenticated download succeeded');
    }

    nock.cleanAll();
    t.end();
  });
});

test('should fail gracefully when 403 and no AWS credentials', (t) => {
  try {
    process.chdir('test/app1');
  } catch (e) {
    // Already in test/app1 from previous test
  }

  // Ensure no AWS credentials
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
  delete process.env.node_pre_gyp_mock_s3;

  const origin = 'https://npg-mock-bucket.s3.us-east-1.amazonaws.com';

  nock.cleanAll();
  const publicScope = nock(origin)
    .get(/\/node-pre-gyp\/node-pre-gyp-test-app1\/v0.1.0\/Release\/node-v\d+-\S+.tar.gz/)
    .reply(403, 'Forbidden');

  const opts = {
    opts: {
      'build-from-source': false,
      'update-binary': true
    }
  };

  opts.package_json = JSON.parse(fs.readFileSync('./package.json'));
  opts.package_json.binary.host = origin;

  install(opts, [], (err) => {
    t.ok(err, 'Should error without credentials');
    t.ok(err.message.includes('AWS credentials not found'), 'Error should mention missing credentials');
    t.equal(err.statusCode, 403, 'Error should have 403 status code');
    t.ok(publicScope.isDone(), 'Public HTTPS request was attempted');

    nock.cleanAll();
    t.end();
  });
});

test('should succeed with public binary (no 403)', (t) => {
  try {
    process.chdir('test/app1');
  } catch (e) {
    // Already in test/app1
  }

  const origin = 'https://npg-mock-bucket.s3.us-east-1.amazonaws.com';
  nock.cleanAll();
  const scope = nock(origin)
    .get(/\/node-pre-gyp\/node-pre-gyp-test-app1\/v0.1.0\/Release\/node-v\d+-\S+.tar.gz/)
    .reply(200, Buffer.from(targz, 'base64'));

  const opts = {
    opts: {
      'build-from-source': false,
      'update-binary': true
    }
  };

  opts.package_json = JSON.parse(fs.readFileSync('./package.json'));
  opts.package_json.binary.host = origin;

  install(opts, [], (err) => {
    t.ifError(err, 'Public binary install should succeed');
    t.ok(scope.isDone(), 'Public download was completed');

    nock.cleanAll();
    t.end();
  });
});

test('should handle 404 without triggering authenticated fallback', (t) => {
  try {
    process.chdir('test/app1');
  } catch (e) {
    // Already in test/app1
  }

  const origin = 'https://npg-mock-bucket.s3.us-east-1.amazonaws.com';

  nock.cleanAll();
  const scope = nock(origin)
    .get(/\/node-pre-gyp\/node-pre-gyp-test-app1\/v0.1.0\/Release\/node-v\d+-\S+.tar.gz/)
    .reply(404, 'Not Found');

  const opts = {
    opts: {
      'build-from-source': false,
      'update-binary': true
    }
  };

  opts.package_json = JSON.parse(fs.readFileSync('./package.json'));
  opts.package_json.binary.host = origin;

  install(opts, [], (err) => {
    t.ok(err, 'Should error with 404');
    t.ok(err.message.includes('404'), 'Error message should mention 404');
    t.notOk(err.message.includes('credentials'), 'Should not mention credentials for 404');
    t.ok(scope.isDone(), 'HTTP request was completed');

    nock.cleanAll();
    t.end();
  });
});
