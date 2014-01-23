
module.exports = exports = publish

exports.usage = 'Publishes pre-built binary'

var fs = require('fs')
  , path = require('path')
  , log = require('npmlog')
  , versioning = require('./util/versioning.js')
  , s3_setup = require('./util/s3_setup.js')
  , mkdirp = require('mkdirp')
  , existsAsync = fs.exists || path.exists
  , AWS = require("aws-sdk")
  , url = require('url')
  , config = require('rc')("node_pre_gyp",{acl:"public-read"});

function publish(gyp, argv, callback) {
    var package_json = JSON.parse(fs.readFileSync('./package.json'));
    versioning.evaluate(package_json, gyp.opts, function(err,opts) {
        if (err) return callback(err);
        var tarball = path.join('build/stage',opts.versioned);
        existsAsync(tarball,function(found) {
            if (!found) {
                return callback(new Error("Cannot publish because " + tarball + " missing: run `node-pre-gyp rebuild` first"))
            }
            if(!config.accessKeyId  || !config.secretAccessKey) {
                return callback(new Error("Unknown S3 `accessKeyId` and `secretAccessKey`"));
            } else {
                s3_setup.detect(package_json.binary.remote_uri,config);
                AWS.config.update(config);
                var s3 =  new AWS.S3();
                var s3_opts = {  ACL: config.acl,
                                 Body: fs.readFileSync(tarball),
                                 Bucket: config.bucket,
                                 Key: path.join(config.prefix,opts.versioned)
                              };
                s3.putObject(s3_opts, function(err, resp){
                    if(err) return callback(err);
                    console.log('['+package_json.name+'] Success: published to http://' + s3_opts.Bucket + '.s3.amazonaws.com/' + s3_opts.Key);
                    return callback();
                });
            }
        });
    });
}
