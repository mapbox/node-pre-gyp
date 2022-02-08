'use strict';

const s3Template = require('@mapbox/s3-bucket-template');
const bucketName = 'mapbox-node-pre-gyp-public-testing-bucket';

module.exports = s3Template.build({
  BucketName: bucketName,
  PublicAccessBlock: false,
  BucketPolicy: {
    'Type': 'AWS::S3::BucketPolicy',
    'DependsOn': 'Bucket',
    'Properties': {
      'Bucket': bucketName,
      'PolicyDocument': {
        'Statement': [
          {
            'Sid': 'Prevent Changing Bucket ACL',
            'Effect': 'Deny',
            'Principal': {
              'AWS': '*'
            },
            'Action': [
              's3:PutBucketAcl'
            ],
            'Resource': [
              {
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    {
                      'Ref': 'AWS::Partition'
                    },
                    ':s3:::',
                    bucketName
                  ]
                ]
              }
            ]
          },
          {
            'Sid': 'Allow setting Objects and ACLs, deleting, getting',
            'Effect': 'Allow',
            'Principal': {
              'AWS': '*'
            },
            'Action': [
              's3:GetObject',
              's3:GetObjectAcl'
            ],
            'Resource': [
              {
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    {
                      'Ref': 'AWS::Partition'
                    },
                    ':s3:::',
                    bucketName,
                    '/*'
                  ]
                ]
              }
            ]
          }
        ]
      }
    }
  }
});