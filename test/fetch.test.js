const fs = require('fs');

const test = require('tape');
const nock = require('nock');
const install = require('../lib/install.js');

test('should follow redirects', (t) => {
  // Dummy tar.gz data, contains a blank directory.
  const targz = 'H4sICPr8u1oCA3kudGFyANPTZ6A5MDAwMDc1VQDTZhAaCGA0hGNobGRqZm5uZmxupGBgaGhiZsKgYMpAB1BaXJJYBHRKYk5pcioedeUZqak5+D2J5CkFhlEwCkbBKBjkAAAyG1ofAAYAAA==';

  // Mock an HTTP redirect
  const n = nock('https://mapbox-node-pre-gyp-public-testing-bucket.s3.us-east-1.amazonaws.com')
    .get(/\/node-pre-gyp\/node-pre-gyp-test-app1\/v0.1.0\/Release\/node-v\d+-\S+.tar.gz/)
    .reply(302, '', {
      'Location': 'https://mapbox-node-pre-gyp-public-testing-bucket.s3.us-east-1.amazonaws.com/otherapp.tar.gz'
    })
    .get('/otherapp.tar.gz')
    .reply(200, Buffer.from(targz, 'base64'));

  const opts = {
    opts: {
      // commands no longer read package.json to it must be passed to them.
      package_json: JSON.parse(fs.readFileSync('./package.json')),
      'build-from-source': false,
      'update-binary': true
    }
  };

  process.chdir('test/app1');

  install(opts, [], (err) => {
    t.ifError(err); // Worked fine
    t.ok(n.isDone()); // All mocks consumed
    t.end();
  });

});

