
module.exports = exports = publish

exports.usage = 'Publishes pre-built binary (requires aws-sdk)'

var fs = require('fs')
  , path = require('path')
  , log = require('npmlog')
  , versioning = require('./util/versioning.js')
  , s3_setup = require('./util/s3_setup.js')
  , mkdirp = require('mkdirp')
  , existsAsync = fs.exists || path.exists
  , url = require('url')
  , config = require('rc')("node_pre_gyp",{acl:"public-read"});

function publish(gyp, argv, callback) {
    var AWS = require("aws-sdk");
    var package_json = JSON.parse(fs.readFileSync('./package.json'));
    var opts = versioning.evaluate(package_json, gyp.opts);
    var tarball = opts.staged_tarball;
    existsAsync(tarball,function(found) {
        if (!found) {
            return callback(new Error("Cannot publish because " + tarball + " missing: run `node-pre-gyp package` first"))
        }
        log.info('publish', 'Detecting s3 credentials');
        s3_setup.detect(opts.hosted_path,config);
        var key_name = url.resolve(config.prefix,opts.package_name)
        log.info('publish', 'Authenticating with s3');
        AWS.config.update(config);
        var s3 =  new AWS.S3();
        var s3_opts = {  Bucket: config.bucket,
                         Key: key_name
                      };
        var remote_package = 'https://' + s3_opts.Bucket + '.s3.amazonaws.com/' + s3_opts.Key;
        log.info('publish', 'Checking for existing binary at ' + remote_package);
        s3.headObject(s3_opts, function(err, meta){
            if (err && err.code == 'NotFound') {
                // we are safe to publish because
                // the object does not already exist
                log.info('publish', 'First time publishing');
                var s3 =  new AWS.S3();
                var s3_obj_opts = {  ACL: config.acl,
                                     Body: fs.createReadStream(tarball),
                                     Bucket: config.bucket,
                                     Key: key_name
                                  };
                s3.putObject(s3_obj_opts, function(err, resp){
                    if(err) return callback(err);
                    console.log('['+package_json.name+'] Success: published to ' + remote_package);
                    return callback();
                });
            } else if(err) {
                log.error('publish','Hit unexpected error trying to publish');
                return callback(err);
            } else {
                log.error('publish','Cannot publish over existing version');
                log.error('publish',"Update the 'version' field in package.json and try again");
                log.error('publish','If the previous version was published in error see:');
                log.error('publish','\t node-pre-gyp unpublish');
                return callback(new Error('Failed publishing to https://' + s3_opts.Bucket + '.s3.amazonaws.com/' + s3_opts.Key));
            }
        });
    });
}
