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

module.exports.get_s3 = function(config) {

  // if not mocking then setup real s3.
  if (!process.env.node_pre_gyp_mock_s3) {
    const AWS = require('aws-sdk');

    AWS.config.update(config);
    const s3 = new AWS.S3();

    // need to change if additional options need to be specified.
    return {
      listObjects(params, callback) {
        return s3.listObjects(params, callback);
      },
      headObject(params, callback) {
        return s3.headObject(params, callback);
      },
      deleteObject(params, callback) {
        return s3.deleteObject(params, callback);
      },
      putObject(params, callback) {
        return s3.putObject(params, callback);
      }
    };
  }

  // here we're mocking. node_pre_gyp_mock_s3 is the scratch directory
  // for the mock code.
  const AWSMock = require('mock-aws-s3');

  AWSMock.config.basePath = process.env.node_pre_gyp_mock_s3;

  const s3 = AWSMock.S3();

  // wrapped callback maker. fs calls return code of ENOENT but AWS.S3 returns
  // NotFound.
  const wcb = (fn) => (err, ...args) => {
    if (err && err.code === 'ENOENT') {
      err.code = 'NotFound';
    }
    return fn(err, ...args);
  };

  return {
    listObjects(params, callback) {
      return s3.listObjects(params, wcb(callback));
    },
    headObject(params, callback) {
      return s3.headObject(params, wcb(callback));
    },
    deleteObject(params, callback) {
      return s3.deleteObject(params, wcb(callback));
    },
    putObject(params, callback) {
      return s3.putObject(params, wcb(callback));
    }
  };

};
