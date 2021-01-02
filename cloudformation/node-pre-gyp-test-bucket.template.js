'use strict';

const s3Template = require('@mapbox/s3-bucket-template');

module.exports = s3Template.build({
  BucketName: 'mapbox-node-pre-gyp-public-tests',
  PublicAccessBlock: false
});