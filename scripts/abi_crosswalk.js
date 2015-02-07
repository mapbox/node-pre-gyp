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

var template = 'https://raw.githubusercontent.com/joyent/node/v{VERSION}/src/';
var v8template = 'https://raw.githubusercontent.com/joyent/node/v{VERSION}/deps/v8/src/version.cc';

var sortObjectByKey = function(obj){
    var keys = [];
    var sorted_obj = {};
    for(var key in obj){
        if(obj.hasOwnProperty(key)){
            keys.push(key);
        }
    }
    // sort keys
    keys.sort(function(a,b) {
      if (semver.gt(a, b)) {
        return 1;
      }
      return -1;
    });
    var len = keys.length;

    for (i = 0; i < len; i++)
    {
      key = keys[i];
      sorted_obj[key] = obj[key];
    }
    return sorted_obj;
};

function get(ver,callback) {
  var header = 'node.h';
  if (semver.gt(ver, 'v0.11.4')) {
    // https://github.com/joyent/node/commit/44ed42bd971d58b294222d983cfe2908e021fb5d#src/node_version.h
    header = 'node_version.h';
  }
  var path = template.replace('{VERSION}',ver) + header;
  var uri = url.parse(path);
  https.get(uri, function(res) {
      if (res.statusCode != 200 ) {
        throw new Error("server returned " + res.statusCode + ' for: ' + path);
      }
      res.setEncoding('utf8');
      var body = '';
      res.on('data', function (chunk) {
        body += chunk;
      });
      res.on('end',function(err) {
        if (err) throw err;
        var term = 'define NODE_MODULE_VERSION';
        var idx = body.indexOf(term);
        var following = body.slice(idx);
        var end = following.indexOf('\n');
        var value = following.slice(term.length,end).trim();
        if (value[0] === '(' && value[value.length-1] == ')') {
          value = value.slice(1,value.length-1);
        } else if (value.indexOf(' ') > -1) {
          value = value.slice(0,value.indexOf(' '));
        }
        var int_val = +value;
        if (int_val !== undefined) {
          // TODO - if val is 1 then we need to get the v8 version from
          // https://github.com/joyent/node/blob/master/deps/v8/src/version.cc
          var v8path = v8template.replace('{VERSION}',ver);
          var v8uri = url.parse(v8path);
          https.get(v8uri, function(res) {
              if (res.statusCode != 200) {
                throw new Error("server returned " + res.statusCode + ' for: ' + path);
              }
              res.setEncoding('utf8');
              var body = '';
              res.on('data', function (chunk) {
                body += chunk;
              });
              res.on('end',function(err) {
                  if (err) throw err;
                  var term = 'define MAJOR_VERSION';
                  var idx = body.indexOf(term);
                  var following = body.slice(idx);
                  var end = following.indexOf('\n');
                  var major = following.slice(term.length,end).trim();
                  var term1 = 'define MINOR_VERSION';
                  var idx1 = body.indexOf(term1);
                  var following1 = body.slice(idx1);
                  var end1 = following1.indexOf('\n');
                  var minor = following1.slice(term1.length,end1).trim();
                  var v8_version = major+'.'+minor;
                  return callback(null,ver,int_val,v8_version);
              });
          });
        }
      });
    });
}

process.on('exit', function(err) {
    if (err) throw err;
    fs.writeFileSync('./lib/util/abi_crosswalk.json',JSON.stringify(sortObjectByKey(cross),null,2));
});

// These need to be manually read and updated based on http://nodejs.org/dist
// because I'm not keen to parse the html and in the http://nodejs.org/dist/npm-versions.txt worked well.
// but joyent has stopped updating this https://github.com/joyent/node/issues/7409
var update_node = true;
if (update_node) {
  var lines = [];
  for (var i=0;i<=28;++i) {
    lines.push('0.8.'+i);
  }
  for (var i=0;i<=36;++i) {
    lines.push('0.10.'+i);
  }
  for (var i=0;i<=16;++i) {
    lines.push('0.11.'+i);
  }
  for (var i=0;i<=0;++i) {
    lines.push('0.12.'+i);
  }
  lines.forEach(function(ver) {
      get(ver,function(err,version,node_abi,v8_version) {
        cross[version] = {node_abi:node_abi,v8:v8_version};
      });
  });
} else {
   cross = JSON.parse(fs.readFileSync('./lib/util/abi_crosswalk.json'));
}

// IO.js
// thanks to rvagg, this is so simple
https.get('https://iojs.org/download//release/index.json', function(res) {
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
