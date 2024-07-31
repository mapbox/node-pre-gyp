'use strict';

const fs = require('fs');
const path = require('path');
const { createUnzip } = require('zlib');
const os = require('os');

const tar = require('tar-fs');
const { HttpsProxyAgent } = require('https-proxy-agent');
const fetch = require('node-fetch');
const { rimraf } = require('rimraf');

const test = require('tape');

const proxy = require('./proxy.util');
const proxyPort = 8124;
const proxyServer = `http://localhost:${proxyPort}`;

// options for fetch
const options = {};

// the temporary download directory and file
const downloadDir = `${os.tmpdir()}/npg-download`;

// https://stackoverflow.com/questions/38599457/how-to-write-a-custom-assertion-for-testing-node-or-javascript-with-tape-or-che
test.Test.prototype.stringContains = function(actual, contents, message) {
  this._assert(actual.indexOf(contents) > -1, {
    message: message || 'should contain ' + contents,
    operator: 'stringContains',
    actual: actual,
    expected: contents
  });
};

test('setup proxy server', (t) => {
  delete process.env.http_proxy;
  delete process.env.https_proxy;
  delete process.env.HTTPS_PROXY;
  delete process.env.all_proxy;
  delete process.env.ALL_PROXY;
  delete process.env.no_proxy;
  delete process.env.NO_PROXY;

  proxy.startServer({ port: proxyPort });
  process.env.https_proxy = process.env.http_proxy = proxyServer;

  options.agent = new HttpsProxyAgent(proxyServer);

  // make sure the download directory deleted then create an empty one
  rimraf(downloadDir).then(() => {
    fs.mkdir('download', (e) => {
      if (e && e.code !== 'EEXIST') {
        t.error(e);
        return;
      }
      t.end();
    });
  });


});

test('verify node fetch with a proxy successfully downloads bcrypt pre-built', (t) => {
  // "{module_name}-v{version}-napi-v{napi_build_version}-{platform}-{arch}-{libc}.tar.gz"
  const url = 'https://github.com/kelektiv/node.bcrypt.js/releases/download/v5.0.1/bcrypt_lib-v5.0.1-napi-v3-linux-x64-glibc.tar.gz';

  async function getBcrypt() {
    const res = await fetch(url, options);
    if (res.status !== 200) {
      throw new Error(`fetch got error ${res.status}`);
    }
    return res.body;
  }

  const withDir = path.join(downloadDir, 'napi-v3', 'bcrypt_lib.node');
  const rawPath = 'napi-v3/bcrypt_lib.node';
  let expectedCount = 0;

  const tarOptions = {
    ignore: (name, header) => {
      if (name === withDir && header.name === rawPath) {
        expectedCount += 1;
      }
      return false;
    }
  };

  getBcrypt()
    .then((stream) => {
      const unzip = createUnzip();
      stream
        .pipe(unzip);

      unzip
        .pipe(tar.extract(`${downloadDir}`, tarOptions));

      return unzip;
    })
    .then((stream) => {
      return new Promise((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
      });
    })
    // if no errors on download and the file is there that's good enough. napi version
    // differences make it harder to select a version that is loadable, and this test
    // is focused on proxy support.
    .then(() => {
      t.equal(expectedCount, 1, 'should find the expected file in the tar stream');
      t.doesNotThrow(() => fs.statSync(withDir));
      t.end();
    })
    .catch((e) => {
      console.log(e);
      t.error(e);
    });
});

// this is really just onFinish() but local to the tests in this file
test(`cleanup after ${__filename}`, (t) => {
  proxy.stopServer();
  delete process.env.NOCK_OFF;
  delete process.env.http_proxy;
  delete process.env.https_proxy;
  try {
    rimraf(downloadDir);
  } catch (err) {
    // ignore errors
  }
  t.end();
});
