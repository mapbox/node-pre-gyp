
module.exports = exports = unpublish

exports.usage = 'Fetches info on published binaries'

var fs = require('fs')
  , path = require('path')
  , log = require('npmlog')
  , versioning = require('./util/versioning.js')
  , s3_setup = require('./util/s3_setup.js')
  , mkdirp = require('mkdirp')
  , existsAsync = fs.exists || path.exists
  , AWS = require("aws-sdk")
  , config = require('rc')("node_pre_gyp",{acl:"public-read"});

function unpublish(gyp, argv, callback) {
    var package_json = JSON.parse(fs.readFileSync('./package.json'));
    versioning.evaluate(package_json, gyp.opts, function(err,opts) {
        if (err) return callback(err);
        if(!config.accessKeyId  || !config.secretAccessKey) {
            return callback(new Error("Unknown S3 `accessKeyId` and `secretAccessKey`"));
        } else {
            s3_setup.detect(package_json.binary.remote_uri,config);
            AWS.config.update(config);
            var s3 =  new AWS.S3();
            var s3_opts = {  Bucket: config.bucket,
                             Prefix: config.prefix
                          };
            s3.listObjects(s3_opts, function(err, meta){
                if (err && err.code == 'NotFound') {
                    return callback(new Error('['+package_json.name+'] Not found: https://' + s3_opts.Bucket + '.s3.amazonaws.com/'+config.prefix));
                } else if(err) {
                    return callback(err);
                } else {
                    log.verbose(JSON.stringify(meta,null,1));
                    if (meta && meta.Contents) {
                        meta.Contents.forEach(function(obj) {
                            console.log(obj.Key);
                        });
                    } else {
                        console.error('No objects found at https://' + s3_opts.Bucket + '.s3.amazonaws.com/'+config.prefix )
                    }
                    return callback();
                }
            });
        }
    });
}
