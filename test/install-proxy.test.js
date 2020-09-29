"use strict";

var test = require('tape');
var needle = require('needle');
var install = require('../lib/install.js');
var sinon = require('sinon');
var HttpsProxyAgent = require('https-proxy-agent');
var nock = require('nock');

test('should set a agent for proxy with needle', function(t) {
  var proxyUrl='http://localhost:3122';
  var needleGetStub = sinon.stub(needle, 'get')
      .onFirstCall().callsFake((uri, requestOpts) => {
    t.deepEqual(requestOpts.agent, new HttpsProxyAgent(proxyUrl))
        // delete the agent after the assert to let needle do a proper request because we do not have a real proxy
    delete requestOpts.agent
    return needle.get(uri, requestOpts)
  })
      .callThrough()

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
  process.env.http_proxy=proxyUrl;

  install(opts, [], function(err) {
    t.ifError(err); // Worked fine
    t.ok(n.isDone()); // All mocks consumed
    needleGetStub.restore()
    t.end();
  });

});

