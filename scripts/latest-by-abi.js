"use strict";

var semver = require('semver');
var data = require('../lib/util/abi_crosswalk.json');

var targets = {};
Object.keys(data).forEach(function(v) {
    var o = data[v];
    var abi;
    if (o.node_abi == 1) {
        abi = 'v8-'+o.v8;
    } else {
        abi = 'node-v'+o.node_abi;
    }
    if (targets[abi] === undefined) {
        targets[abi] = v;
    } else {
        var cur = targets[abi];
        if (semver.gt(v,cur)) {
            targets[abi] = v;
        }
    }
});

Object.keys(targets).forEach(function(k) {
    console.log(targets[k]);
});
