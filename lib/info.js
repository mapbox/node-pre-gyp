'use strict';

module.exports = exports = info;

exports.usage = 'Lists all published binaries (requires aws-sdk)';

const log = require('npmlog');
const versioning = require('./util/versioning.js');
const s3_setup = require('./util/s3_setup.js');
const config = require('rc')('node_pre_gyp', { acl: 'public-read' });

function info(gyp, argv, callback) {
  const AWS = require('aws-sdk');
  const package_json = gyp.package_json;
  const opts = versioning.evaluate(package_json, gyp.opts);
  s3_setup.detect(opts.hosted_path, config);
  AWS.config.update(config);
  const s3 =  new AWS.S3();
  const s3_opts = {  Bucket: config.bucket,
    Prefix: config.prefix
  };
  s3.listObjects(s3_opts, (err, meta) => {
    if (err && err.code === 'NotFound') {
      return callback(new Error('[' + package_json.name + '] Not found: https://' + s3_opts.Bucket + '.s3.amazonaws.com/' + config.prefix));
    } else if (err) {
      return callback(err);
    } else {
      log.verbose(JSON.stringify(meta, null, 1));
      if (meta && meta.Contents) {
        meta.Contents.forEach((obj) => {
          console.log(obj.Key);
        });
      } else {
        console.error('[' + package_json.name + '] No objects found at https://' + s3_opts.Bucket + '.s3.amazonaws.com/' + config.prefix);
      }
      return callback();
    }
  });
}
