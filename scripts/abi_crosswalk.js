"use strict";

var fs = require('fs');
var fetch_crosswalk = require('../lib/util/crosswalk').fetch_crosswalk;

/*

usage:

node scripts/abi_crosswalk.js

*/

var cross;

fetch_crosswalk(function(err, data) {
    if (err) throw err;
    cross = data;
});

process.on('exit', function(err) {
    if (err) throw err;
    fs.writeFileSync('./lib/util/abi_crosswalk.json', '[\n' + cross.map(function(r) { return JSON.stringify(r); }).join(',\n') + '\n]');
});
