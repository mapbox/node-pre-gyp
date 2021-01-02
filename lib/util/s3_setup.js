'use strict';

module.exports = exports;

const url = require('url');

module.exports.detect = function(to, config) {
  const uri = url.parse(to);
  const parts = uri.hostname.split('.s3');
  const bucket = parts[0];
  config.prefix = (!uri.pathname || uri.pathname === '/') ? '' : uri.pathname.replace('/', '');
  if (!bucket) {
    return;
  }
  if (!config.bucket) {
    config.bucket = bucket;
  }
  if (!config.region) {
    const region = parts[1].slice(1).split('.')[0];
    if (region === 'amazonaws') {
      config.region = 'us-east-1';
    } else {
      config.region = region;
    }
  }
};
