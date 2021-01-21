'use strict';

const fs = require('fs');

const test = require('tape');
const { mockS3Http } = require('../lib/node-pre-gyp.js');
const nock = require('nock');
const install = require('../lib/install.js');

test.onFinish(() => {
  mockS3Http('on');
});

test('should follow redirects', (t) => {
  // clear existing mocks
  const was = mockS3Http('off');

  // Dummy tar.gz data, contains a blank directory.
  const targz = 'H4sICPr8u1oCA3kudGFyANPTZ6A5MDAwMDc1VQDTZhAaCGA0hGNobGRqZm5uZmxupGBgaGhiZsKgYMpAB1BaXJJYBHRKYk5pcioedeUZqak5+D2J5CkFhlEwCkbBKBjkAAAyG1ofAAYAAA==';
  // Mock an HTTP redirect
  const scope = nock('https://mapbox-node-pre-gyp-public-testing-bucket.s3.us-east-1.amazonaws.com')
    .get(/\/node-pre-gyp\/node-pre-gyp-test-app1\/v0.1.0\/Release\/node-v\d+-\S+.tar.gz/)
    .reply(302, '', {
      'Location': 'https://mapbox-node-pre-gyp-public-testing-bucket.s3.us-east-1.amazonaws.com/otherapp.tar.gz'
    })
    .get('/otherapp.tar.gz')
    .reply(200, Buffer.from(targz, 'base64'));

  const opts = {
    opts: {
      'build-from-source': false,
      'update-binary': true
    }
  };

  process.chdir('test/app1');

  // commands no longer read package.json so it must be passed to them.
  opts.package_json = JSON.parse(fs.readFileSync('./package.json'));

  console.log('mockS3Http was', was, 'is', mockS3Http('get'));

  install(opts, [], (err) => {
    t.ifError(err); // Worked fine
    t.ok(scope.isDone()); // All mocks consumed
    t.end();
  });

});

