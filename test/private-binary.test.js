'use strict';

const fs = require('fs');
const path = require('path');
const test = require('tape');
const nock = require('nock');
const install = require('../lib/install.js');
const os = require('os');
const rimraf = require('rimraf');

// Dummy tar.gz data - contains a blank directory
const targz = 'H4sICPr8u1oCA3gudGFyANPTZ6A5MDAwMDc1VQDTZhAaCGA0hGNobGRqZm5uZmxupGBgaGhiZsKgYMpAB1BaXJJYBHRKYk5pcioedeUZqak5+D2J5CkFhlEwCkbBKBjkAAAyG1ofAAYAAA==';

// Determine the project root (where package.json with @mapbox/node-pre-gyp exists)
const projectRoot = path.join(__dirname, '..');

// Helper to clean mock S3 directory
function cleanMockS3() {
  const mockDir = path.join(os.tmpdir(), 'mock');
  if (fs.existsSync(mockDir)) {
    rimraf.sync(mockDir);
  }
}

test('should fallback to authenticated download on 403 Forbidden', (t) => {
  // Clean mock S3 to ensure deterministic behavior
  cleanMockS3();
  process.env.node_pre_gyp_mock_s3 = 'true';
  process.env.AWS_ACCESS_KEY_ID = 'mock-key';
  process.env.AWS_SECRET_ACCESS_KEY = 'mock-secret';

  const origin = 'https://npg-mock-bucket.s3.us-east-1.amazonaws.com';
  const run = require('./run.util.js');
  const app = { name: 'app1', args: '' };

  // First build and publish to mock S3 to create the file
  run('node-pre-gyp', 'configure build package publish', '', app, {}, (buildErr) => {
    t.ifError(buildErr, 'Build and publish to mock S3 should succeed');

    nock.cleanAll();
    const publicScope = nock(origin)
      .get(/\/node-pre-gyp\/node-pre-gyp-test-app1\/v0.1.0\/Release\/node-v\d+-\S+.tar.gz/)
      .reply(403, 'Forbidden');

    const appDir = path.join(projectRoot, 'test', 'app1');
    process.chdir(appDir);
    const installOpts = {
      opts: {
        'build-from-source': false,
        'update-binary': true
      },
      package_json: JSON.parse(fs.readFileSync('./package.json'))
    };
    installOpts.package_json.binary.host = origin;

    // Run install - should get 403 from HTTP, then succeed with authenticated S3
    install(installOpts, [], (err) => {
      delete process.env.node_pre_gyp_mock_s3;
      delete process.env.AWS_ACCESS_KEY_ID;
      delete process.env.AWS_SECRET_ACCESS_KEY;

      t.ok(publicScope.isDone(), 'Public HTTPS request was attempted (got 403)');
      t.ifError(err, 'Authenticated S3 download should succeed after 403');

      nock.cleanAll();
      cleanMockS3();
      t.end();
    });
  });
});

test('should fail gracefully when 403 and no AWS credentials', (t) => {
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

  // cd into app directory from project root
  const appDir = path.join(projectRoot, 'test', 'app1');
  process.chdir(appDir);
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

  // cd into app directory from project root
  const appDir = path.join(projectRoot, 'test', 'app1');
  process.chdir(appDir);
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

  // cd into app directory from project root
  const appDir = path.join(projectRoot, 'test', 'app1');
  process.chdir(appDir);
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
