"use strict";

var https = require("https");
var url = require('url');
var semver = require('semver');
var fs = require('fs');
/*

usage:

node scripts/abi_crosswalk.js

*/

var cross = {};

// IO.js
// thanks to rvagg, this is so simple
// https://github.com/iojs/build/issues/94
https.get('https://iojs.org/download/release/index.json', function(res) {
  if (res.statusCode != 200 ) {
    throw new Error("server returned " + res.statusCode + ' for iojs.org');
  }
  res.setEncoding('utf8');
  var body = '';
  res.on('data', function (chunk) {
    body += chunk;
  });
  res.on('end',function(err) {
    if (err) throw err;
    var releases = JSON.parse(body);
    releases.forEach(function(release) {
        cross[release.version.replace('v','')] = {node_abi:+release.modules,v8:release.v8.split('.').slice(0,2).join('.')};
    });
  });
});

https.get('https://nodejs.org/download/release/index.json', function(res) {
  if (res.statusCode != 200 ) {
    throw new Error("server returned " + res.statusCode + ' for nodejs.org');
  }
  res.setEncoding('utf8');
  var body = '';
  res.on('data', function (chunk) {
    body += chunk;
  });
  res.on('end',function(err) {
    if (err) throw err;
    var releases = JSON.parse(body);
    releases.forEach(function(release) {
        cross[release.version.replace('v','')] = {node_abi:+release.modules,v8:release.v8.split('.').slice(0,2).join('.')};
    });
  });
});