var hosting = require('./util/hosting');

module.exports = exports = unpublish;

exports.usage = 'Unpublishes pre-built binary (requires aws-sdk)';

var fs = require('fs')
  , log = require('npmlog')
  , versioning = require('./util/versioning.js')
  , url = require('url')
  , config = require('rc')("node_pre_gyp",{acl:"public-read"});

function unpublish(gyp, argv, callback) {
    var package_json = JSON.parse(fs.readFileSync('./package.json'));
    var opts = versioning.evaluate(package_json, gyp.opts);

    hosting(opts).unpublish(opts, config, callback);
}
