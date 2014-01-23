
module.exports = exports;

var fs = require('fs')
  , tar = require('tar')
  , path = require('path')
  , zlib = require('zlib')
  , log = require('npmlog')
  , semver = require('semver')
  , request = require('request')
  , win = process.platform == 'win32'
  , os = require('os')
  , existsAsync = fs.exists || path.exists
  , url = require('url')
  , cp = require('child_process')


module.exports.detect = function(to,config) {
    var uri = url.parse(to);
    var url_paths = uri.hostname.split('.');
    config.prefix = (!uri.pathname || uri.pathname == '/') ? '' : uri.pathname.replace('/','');
    if (!config.bucket && url_paths && url_paths[0]) {
        config.bucket = url_paths[0];
    }
    if (!config.region && url_paths && url_paths[1]) {
        var s3_domain = url_paths[1];
        if (s3_domain.slice(0,3) == 's3-' &&
            s3_domain.length >= 3) {
            // it appears the region is explicit in the url
            config.region = s3_domain.replace('s3-','');
        }
    }
}
