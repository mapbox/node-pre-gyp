'use strict';

const test = require('tape');
const nock = require('nock');
const install = require('../lib/install.js');

test('should follow redirects', (t) => {
  // Dummy tar.gz data, contains a blank directory.
  const targz = 'H4sICPr8u1oCA3kudGFyANPTZ6A5MDAwMDc1VQDTZhAaCGA0hGNobGRqZm5uZmxupGBgaGhiZsKgYMpAB1BaXJJYBHRKYk5pcioedeUZqak5+D2J5CkFhlEwCkbBKBjkAAAyG1ofAAYAAA==';

  const pattern = /app1-v0.1.0-node-v\d+-\S+.tar.gz/;
  // Mock an HTTP redirect
  const n = nock('https://node-pre-gyp-tests.s3-us-west-1.amazonaws.com')
    .persist()
    .get(pattern)
    .reply(302, undefined, {
      'Location': 'https://node-pre-gyp-tests.s3-us-west-1.amazonaws.com/otherapp.tar.gz'
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

  install(opts, [], (err) => {
    t.ifError(err); // Worked fine
    t.ok(n.isDone()); // All mocks consumed
    t.end();
  });

});

