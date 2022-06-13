'use strict';

const s3Template = require('@mapbox/s3-bucket-template');

const bucket = s3Template.build({
  BucketName: 'mapbox-node-pre-gyp-public-testing-bucket',
  // We allow public access to objects IF they have been set to "public-read"
  // node-pre-gyp sets public-read when publishing binaries:
  // https://github.com/mapbox/node-pre-gyp/blob/eb1ec94913cbb72acbf2a4dc69896581d131fef8/lib/publish.js#L46-L51
  PublicAccessBlock: false,
  // The custom policy requires users to s3:PutObjectAcl when publishing
  // binaries. Otherwise these objects cannot be downloaded by the public internet
  // when installing.
  BucketPolicy: {
    Type: 'AWS::S3::BucketPolicy',
    DependsOn: 'Bucket',
    Properties: {
      Bucket: 'mapbox-node-pre-gyp-public-testing-bucket',
      PolicyDocument: {
        Statement: [
          {
            Sid: 'Deny changing the bucket ACL',
            Effect: 'Deny',
            Principal: {
              AWS: '*'
            },
            Action: 's3:PutBucketAcl',
            Resource: 'arn:aws:s3:::mapbox-node-pre-gyp-public-testing-bucket'
          },
          // prevent deletions of any kind (human or application) on this bucket
          // even though node-pre-gyp allows for binaries to be deleted, Mapbox
          // intends to prevent them from being removed.
          {
            Sid: 'DenyDeletions',
            Effect: 'Deny',
            Principal: '*',
            Action: 's3:Delete*',
            Resource: [
              'arn:aws:s3:::mapbox-node-pre-gyp-public-testing-bucket',
              'arn:aws:s3:::mapbox-node-pre-gyp-public-testing-bucket/*'
            ]
          }
        ]
      }
    }
  }
});

module.exports = bucket;