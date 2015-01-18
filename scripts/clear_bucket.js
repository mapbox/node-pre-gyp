"use strict";

var fs = require('fs');
var versioning = require('../lib/util/versioning.js');
var s3_setup = require('../lib/util/s3_setup.js');
var config = require('rc')("node_pre_gyp",{acl:"public-read"});

if(!config.accessKeyId  || !config.secretAccessKey) {
    throw new Error("Unknown S3 `accessKeyId` and `secretAccessKey`");
} else {
    var AWS = require("aws-sdk");
    var package_json = JSON.parse(fs.readFileSync('./test/app1/package.json'));
    var opts = versioning.evaluate(package_json, {});
    s3_setup.detect(opts.hosted_path,config);
    AWS.config.update(config);
    var s3 =  new AWS.S3();
    var s3_opts = {  Bucket: config.bucket,
                     Prefix: config.prefix
                  };
    s3.listObjects(s3_opts, function(err, meta){
        if (err) {
            throw new Error('['+package_json.name+'] Not found: https://' + s3_opts.Bucket + '.s3.amazonaws.com/'+config.prefix);
        } else {
            meta.Contents.forEach(function(item) {
              var s3_obj_opts = {  Bucket: config.bucket,
                                   Key: item.Key
                                };
              s3.deleteObject(s3_obj_opts, function(err) {
                  if (err) console.log(err);
                  console.log('deleted '+ item.Key);
              });
            });
        }
    });
}
