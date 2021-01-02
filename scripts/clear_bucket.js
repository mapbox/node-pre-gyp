'use strict';

const fs = require('fs');
const versioning = require('../lib/util/versioning.js');
const s3_setup = require('../lib/util/s3_setup.js');
const config = require('rc')('node_pre_gyp', { acl: 'public-read' });

if (!config.accessKeyId  || !config.secretAccessKey) {
  throw new Error('Unknown S3 `accessKeyId` and `secretAccessKey`');
} else {
  const AWS = require('aws-sdk');
  const package_json = JSON.parse(fs.readFileSync('./test/app1/package.json'));
  const opts = versioning.evaluate(package_json, {});
  s3_setup.detect(opts.hosted_path, config);
  AWS.config.update(config);
  const s3 =  new AWS.S3();
  const s3_opts = {  Bucket: config.bucket,
    Prefix: config.prefix
  };
  s3.listObjects(s3_opts, (err, meta)=> {
    if (err) {
      throw new Error('[' + package_json.name + '] Not found: https://' + s3_opts.Bucket + '.s3.amazonaws.com/' + config.prefix);
    } else {
      meta.Contents.forEach((item) => {
        const s3_obj_opts = {  Bucket: config.bucket,
          Key: item.Key
        };
        s3.deleteObject(s3_obj_opts, (err2) => {
          if (err2) console.log(err2);
          console.log('deleted ' + item.Key);
        });
      });
    }
  });
}
