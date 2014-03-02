
module.exports = exports;

var url = require('url')

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
