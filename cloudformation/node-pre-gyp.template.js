const s3Template = require('@mapbox/s3-bucket-template');
const cf = require('@mapbox/cloudfriend');

const template = s3Template.build({
  BucketName: 'mapbox-node-pre-gyp-public-testing-bucket',
  PublicAccessBlockOptions: {
    BlockPublicAcls: true,
    IgnorePublicAcls: true,
    BlockPublicPolicy: false,
    RestrictPublicBuckets: false,
  },
  BucketPolicy: {
    Type: 'AWS::S3::BucketPolicy',
    Properties: {
      Bucket: cf.ref('Bucket'),
      PolicyDocument: {
        Statement: [
          {
            Effect: 'Allow',
            Action: 's3:GetObject',
            Principal: '*',
            Resource: 'arn:aws:s3:::mapbox-node-pre-gyp-public-testing-bucket/*',
          },
        ],
      },
    },
  },
});

delete template.Resources.Bucket.Properties.AccessControl;
module.exports = template;
