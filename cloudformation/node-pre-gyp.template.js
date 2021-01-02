'use strict';

const s3Template = require('@mapbox/s3-bucket-template');
const bucketName = require('./bucketName');

module.exports = s3Template.build({
  BucketName: bucketName,
  PublicAccessBlock: false
});