'use strict';

const cf = require('@mapbox/cloudfriend');
const bucketName = require('./bucketName');

module.exports = {
  AWSTemplateFormatVersion: '2010-09-09',
  Description: `user for publishing to s3://${bucketName}/node-pre-gyp`,
  Resources: {
    User: {
      Type: 'AWS::IAM::User',
      Properties: {
        Policies: [
          {
            PolicyName: 'list',
            PolicyDocument: {
              Statement: [
                {
                  Action: ['s3:ListBucket'],
                  Effect: 'Allow',
                  Resource: `arn:aws:s3:::${bucketName}`,
                  Condition : {
                    StringLike : {
                      "s3:prefix": [ "node-pre-gyp/*"]
                    }
                  }
                }
              ]
            }
          },
          {
            PolicyName: 'publish',
            PolicyDocument: {
              Statement: [
                {
                  Action: [
                    's3:DeleteObject',
                    's3:GetObject',
                    's3:GetObjectAcl',
                    's3:PutObject',
                    's3:PutObjectAcl'
                  ],
                  Effect: 'Allow',
                  Resource: `arn:aws:s3:::s3://${bucketName}/node-pre-gyp/*`
                }
              ]
            }
          }
        ]
      }
    },
    AccessKey: {
      Type: 'AWS::IAM::AccessKey',
      Properties: {
        UserName: cf.ref('User')
      }
    }
  },
  Outputs: {
    AccessKeyId: {
      Value: cf.ref('AccessKey')
    },
    SecretAccessKey: {
      Value: cf.getAtt('AccessKey', 'SecretAccessKey')
    }
  }
};