
module.exports = exports = unpublish

exports.usage = 'Unpublishes pre-built binary'

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
                             Key: path.join(config.prefix,opts.versioned)
                          };
            s3.headObject(s3_opts, function(err, meta){
                if (err && err.code == 'NotFound') {
                    console.log('['+package_json.name+'] Not found: https://' + s3_opts.Bucket + '.s3.amazonaws.com/' + s3_opts.Key);
                    return callback();
                } else if(err) {
                    return callback(err);
                } else {
                    log.info(JSON.stringify(meta));
                    s3.deleteObject(s3_opts, function(err, resp){
                        if (err) return callback(err);
                        log.info(JSON.stringify(resp));
                        console.log('['+package_json.name+'] Success: removed https://' + s3_opts.Bucket + '.s3.amazonaws.com/' + s3_opts.Key);
                        return callback();
                    })
                }
            });
        }
    });
}
