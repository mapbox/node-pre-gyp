'use strict';

const fs = require('fs');

const test = require('tape');
const nock = require('nock');
const install = require('../lib/install.js');

test('should follow redirects', (t) => {
  // always use mock host for this test
  const origin = 'https://npg-mock-bucket.s3.us-east-1.amazonaws.com';

  // dummy tar.gz data, contains a blank directory.
  const targz = 'H4sICPr8u1oCA3kudGFyANPTZ6A5MDAwMDc1VQDTZhAaCGA0hGNobGRqZm5uZmxupGBgaGhiZsKgYMpAB1BaXJJYBHRKYk5pcioedeUZqak5+D2J5CkFhlEwCkbBKBjkAAAyG1ofAAYAAA==';


  // clear existing mocks
  nock.cleanAll();
  // and create mock for an HTTP redirect
  const scope = nock(origin)
    .persist()
    .get(/\/node-pre-gyp\/node-pre-gyp-test-app1\/v0.1.0\/Release\/node-v\d+-\S+.tar.gz/)
    .reply(302, '', {
      'Location': `${origin}/otherapp.tar.gz`
    })
    .get('/otherapp.tar.gz')
    .reply(200, Buffer.from(targz, 'base64'));

  const opts = {
    opts: {
      'build-from-source': false,
      'update-binary': true
    }
  };

  // cd into app directory
  process.chdir('test/app1');

  // get data from package.json
  opts.package_json = JSON.parse(fs.readFileSync('./package.json'));
  // data in package.json may be changed from mock to real bucket by user.
  // make sure host is always pointing to the mocked bucket as set above
  opts.package_json.binary.host = origin;

  // run the command by calling the function
  install(opts, [], (err) => {
    t.ifError(err); // worked fine
    t.ok(scope.isDone()); // all mocks consumed
    nock.cleanAll(); // clean this mock
    t.end();
  });
});
