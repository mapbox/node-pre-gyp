'use strict';

var https = require('https');
var fs = require('fs');

var configAddrs = process.env.NODE_PRE_GYP_ABI_CROSSWALK_SOURCES;

var SOURCE_URLS = module.exports.SOURCE_URLS = configAddrs ? configAddrs.split(',') : [
    'https://iojs.org/download/release/index.json',
    'https://nodejs.org/download/release/index.json'
];

module.exports.fetch_crosswalkFromUrl = fetch_crosswalkFromUrl;
function fetch_crosswalkFromUrl(url, callback) {
    https.get(url, function(res) {
        if (res.statusCode != 200 ) {
            callback(new Error('server returned ' + res.statusCode + ' for ' + url));
        }
        res.setEncoding('utf8');
        var body = '';
        res.on('data', function (chunk) {
            body += chunk;
        });
        res.on('end',function(err) {
            if(err) return callback(err);
            callback(null, JSON.parse(body));
        });
    });
}

module.exports.fetch_crosswalk = fetch_crosswalk;
function fetch_crosswalk(sources, callback) {
    var data = [];
    if(arguments.length === 1) {
        callback = sources;
        sources = SOURCE_URLS;
    }
    do_fetch_crosswalk(sources, callback);

    function do_fetch_crosswalk(sources, callback) {
        fetch_crosswalkFromUrl(sources[0], function(err, d) {
            if(err) return callback(err);
            data = data.concat(d);
            if(sources.length === 1) return callback(null, data);
            do_fetch_crosswalk(sources.slice(1), callback);
        });
    }
}

var abi_crosswalk;

// abi_crosswalk downloaded with ./scripts/abi_crosswalk.js
module.exports.load_crosswalk = load_crosswalk;
function load_crosswalk(path) {
    if(path) {
        abi_crosswalk = JSON.parse(fs.readFileSync(path));
        return;

    }
    // This is used for unit testing to provide a fake
    // ABI crosswalk that emulates one that is not updated
    // for the current version
    if (process.env.NODE_PRE_GYP_ABI_CROSSWALK) {
        abi_crosswalk = require(process.env.NODE_PRE_GYP_ABI_CROSSWALK);
    } else {
        abi_crosswalk = require('./abi_crosswalk.json');
    }
}

module.exports.find = find;
function find(version) {
    if(!abi_crosswalk) load_crosswalk();
    for(var i = 0, length = abi_crosswalk.length; i < length; i++) {
        var release = abi_crosswalk[i];
        if(release.version === version) return release;
    }
}

module.exports.get_crosswalk = function() {
    if(!abi_crosswalk) load_crosswalk();
    return abi_crosswalk;
};
