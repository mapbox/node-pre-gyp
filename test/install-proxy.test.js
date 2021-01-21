'use strict';

const test = require('tape');
const fs = require('fs');
const needle = require('needle');
const install = require('../lib/install.js');
const sinon = require('sinon');
const HttpsProxyAgent = require('https-proxy-agent');
const nock = require('nock');

test('should set a agent for proxy with needle', (t) => {
  const proxyUrl = 'http://localhost:3122';
  const needleGetStub = sinon.stub(needle, 'get')
    .onFirstCall().callsFake((uri, requestOpts) => {
      t.deepEqual(requestOpts.agent, new HttpsProxyAgent(proxyUrl));
      // delete the agent after the assert to let needle do a proper request because we do not have a real proxy
      delete requestOpts.agent;
      return needle.get(uri, requestOpts);
    })
    .callThrough();

  // Dummy tar.gz data, contains a blank directory.
  const targz = 'H4sICPr8u1oCA3kudGFyANPTZ6A5MDAwMDc1VQDTZhAaCGA0hGNobGRqZm5uZmxupGBgaGhiZsKgYMpAB1BaXJJYBHRKYk5pcioedeUZqak5+D2J5CkFhlEwCkbBKBjkAAAyG1ofAAYAAA==';

  // Mock an HTTP redirect
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

  process.env.http_proxy = proxyUrl;

  install(opts, [], (err) => {
    t.ifError(err); // Worked fine
    t.ok(scope.isDone()); // All mocks consumed
    needleGetStub.restore();
    t.end();
  });

});

