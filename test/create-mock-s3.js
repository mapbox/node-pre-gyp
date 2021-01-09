'use strict';

const nock = require('nock');
const fs = require('fs');
const path = require('path');

// the bucket as addressed by http.
const host = 'https://mapbox-node-pre-gyp-public-testing-bucket.s3.us-east-1.amazonaws.com';

if (!process.env.node_pre_gyp_mock_s3) {
  throw new Error('missing env var node_pre_gyp_mock_s3');
}

const mockDir = process.env.node_pre_gyp_mock_s3 + '/mapbox-node-pre-gyp-public-testing-bucket';

// example request:
// "https://mapbox-node-pre-gyp-public-testing-bucket.s3.us-east-1.amazonaws.com/node-pre-gyp/node-pre-gyp-test-app1/v0.1.0/Release/node-v72-linux-x64.tar.gz"
// uri:
// /node-pre-gyp/node-pre-gyp-test-app1/v0.1.0/Release/node-v72-linux-x64.tar.gz

// eslint-disable-next-line no-unused-vars
function get(uri, requestBody) {
  const filepath = path.join(mockDir, uri.replace('%2B', '+'));

  try {
    fs.accessSync(filepath, fs.constants.R_OK);
  } catch (e) {
    return [404, `not found: ${uri}\n`];
  }

  // the mock s3 functions just write to disk, so just read from it.
  return [200, fs.createReadStream(filepath)];
}


// eslint-disable-next-line no-unused-vars
const scope = nock(host)
  .persist()
  .get(() => true)         // accept any uri
  .reply(get);
