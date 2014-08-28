var hosting = require('./util/hosting');

module.exports = exports = publish;

exports.usage = 'Publishes pre-built binary (requires aws-sdk)';

var fs = require('fs')
  , path = require('path')
  , log = require('npmlog')
  , versioning = require('./util/versioning.js')
  , existsAsync = fs.exists || path.exists
  , url = require('url')
  , config = require('rc')("node_pre_gyp",{acl:"public-read"});

function publish(gyp, argv, callback) {
    var package_json = JSON.parse(fs.readFileSync('./package.json'));
    var opts = versioning.evaluate(package_json, gyp.opts);
    var tarball = opts.staged_tarball;
    existsAsync(tarball,function(found) {
        if (!found) {
            return callback(new Error("Cannot publish because " + tarball + " missing: run `node-pre-gyp package` first"));
        }
        hosting(opts).publish(opts, config, callback);
    });
}
