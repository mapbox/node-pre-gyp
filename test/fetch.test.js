"use strict";

var test = require('tape');
var nock = require('nock');
var install = require('../lib/install.js');

test('should follow redirects', function(t) {
  // Dummy tar.gz data, contains a blank directory.
  var targz = 'H4sICPr8u1oCA3kudGFyANPTZ6A5MDAwMDc1VQDTZhAaCGA0hGNobGRqZm5uZmxupGBgaGhiZsKgYMpAB1BaXJJYBHRKYk5pcioedeUZqak5+D2J5CkFhlEwCkbBKBjkAAAyG1ofAAYAAA==';

  // Mock an HTTP redirect
  var n = nock('https://node-pre-gyp-tests.s3-us-west-1.amazonaws.com')
      .get(/\/app1-v0.1.0-node-v\d+-\S+.tar.gz/)
      .reply(302, '', {
        'Location': 'https://node-pre-gyp-tests.s3-us-west-1.amazonaws.com/otherapp.tar.gz'
      })
      .get('/otherapp.tar.gz')
      .reply(200, Buffer.from(targz, 'base64'));

  var opts = {
    opts: {
      'build-from-source': false,
      'update-binary': true
    }
  };

  process.chdir('test/app1');

  install(opts, [], function(err) {
    t.ifError(err); // Worked fine
    t.ok(n.isDone()); // All mocks consumed
    t.end();
  });

});

