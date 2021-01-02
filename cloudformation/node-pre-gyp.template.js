'use strict';

const s3Template = require('@mapbox/s3-bucket-template');
const bucketName = require('./bucketName');

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
            'Sid': 'Allow setting Object ACLs',
            'Effect': 'Allow',
            'Principal': {
              'AWS': '*'
            },
            'Action': [
              's3:PutObjectAcl'
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