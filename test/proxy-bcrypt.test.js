'use strict';

const fs = require('fs');
const path = require('path');

const Agent = require('https-proxy-agent');
const fetch = require('node-fetch');
const rimraf = require('rimraf');
const unpack = require('@particle/unpack-file');

const test = require('tape');

// this is a derived from build.test.js and should be kept in sync with it
// as much as possible.
const { mockS3Http } = require('../lib/node-pre-gyp.js');
const proxy = require('./proxy.util');

const proxyPort = 8124;
const proxyServer = `http://localhost:${proxyPort}`;
// options for fetch
const options = {};

let initial_s3_host;
let initial_mock_s3;

// the temporary download directory and file
const downloadDir = 'download';
const tarfileName = 'bruce.tar.gz';

// https://stackoverflow.com/questions/38599457/how-to-write-a-custom-assertion-for-testing-node-or-javascript-with-tape-or-che
test.Test.prototype.stringContains = function(actual, contents, message) {
  this._assert(actual.indexOf(contents) > -1, {
    message: message || 'should contain ' + contents,
    operator: 'stringContains',
    actual: actual,
    expected: contents
  });
};

//
// skip tests that require a real S3 bucket when in a CI environment
// and the AWS access key is not available.
//
const isCI = process.env.CI && process.env.CI.toLowerCase() === 'true'
  && !process.env.AWS_ACCESS_KEY_ID;

function ciSkip(...args) {
  if (isCI) {
    test.skip(...args);
  } else {
    test(...args);
  }
}
ciSkip.skip = function(...args) {
  test.skip(...args);
};

test('setup proxy server', (t) => {
  delete process.env.http_proxy;
  delete process.env.https_proxy;
  delete process.env.HTTPS_PROXY;
  delete process.env.all_proxy;
  delete process.env.ALL_PROXY;
  delete process.env.no_proxy;
  delete process.env.NO_PROXY;
  process.env.NOCK_OFF = true;

  initial_mock_s3 = process.env.node_pre_gyp_mock_s3;
  delete process.env.node_pre_gyp_mock_s3;
  mockS3Http('off');

  proxy.startServer({ port: proxyPort });
  process.env.https_proxy = process.env.http_proxy = proxyServer;

  options.agent = new Agent(proxyServer);

  process.env.NOCK_OFF = true;

  fs.mkdir('download', (e) => {
    if (e && e.code !== 'EEXIST') {
      t.error(e);
      return;
    }
    t.end();
  });
});

test('verify node fetch with a proxy successfully downloads bcrypt pre-built', (t) => {
  const url = 'https://github.com/kelektiv/node.bcrypt.js/releases/download/v5.0.1/bcrypt_lib-v5.0.1-napi-v3-linux-x64-musl.tar.gz';

  async function getBcrypt() {
    const res = await fetch(url, options);
    if (res.status !== 200) {
      throw new Error('fetch got', res.status);
    }
    return res.body;
  }

  const dest = `${downloadDir}/${tarfileName}`;
  getBcrypt()
    .then((stream) => {
      stream.pipe(fs.createWriteStream(dest));
      return stream;
    })
    .then((stream) => {
      return new Promise((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
      });
    })
    // if no errors on download and it unpacks that should be good enough
    .then(() => unpack.unpackTarGz(path.resolve(dest), path.resolve(downloadDir)))
    .then(() => {
      t.doesNotThrow(() => fs.statSync(`${downloadDir}/napi-v3`));
      t.doesNotThrow(() => fs.statSync(`${downloadDir}/napi-v3/bcrypt_lib.node`));
      t.end();
    })
    .catch((e) => {
      t.error(e);
    });
});


// this is really just onFinish() but local to the tests in this file
test(`cleanup after ${__filename}`, (t) => {
  mockS3Http('on');
  proxy.stopServer();
  delete process.env.NOCK_OFF;
  delete process.env.http_proxy;
  delete process.env.https_proxy;
  process.env.node_pre_gyp_s3_host = initial_s3_host;
  process.env.node_pre_gyp_mock_s3 = initial_mock_s3;
  // ignore errors
  rimraf(downloadDir, () => t.end());
});
