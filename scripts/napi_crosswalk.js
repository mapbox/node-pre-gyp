"use strict";

var https = require("https");
var semver = require('semver');
var data = require('../lib/util/abi_crosswalk.json');
var url = require('url');
var fs = require('fs');

var template = 'https://raw.githubusercontent.com/nodejs/node/v{VERSION}/src/';

function get(ver,callback) {
  var header = 'node_version.h';
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
        var term = 'define NAPI_VERSION';
        var idx = body.indexOf(term);
        var following = body.slice(idx);
        var end = following.indexOf('\n');
        var value = following.slice(term.length,end).trim();
        if (value[0] === '(' && value[value.length-1] == ')') {
          value = value.slice(1,value.length-1);
        } else if (value.indexOf(' ') > -1) {
          value = value.slice(0,value.indexOf(' '));
        }
        return callback(null,value);
      });
    });
}

var cross = {};

var sortObjectByKey = function(obj){
    var keys = [];
    var sorted_obj = {};
    for(var key in obj){
        if(obj.hasOwnProperty(key)){
            keys.push(key);
        }
    }
    // sort keys
    keys.sort();
    var len = keys.length;

    for (var i = 0; i < len; i++)
    {
      key = keys[i];
      sorted_obj[key] = obj[key];
    }
    return sorted_obj;
};

process.on('exit', function(err) {
    if (err) throw err;
    var targets = {};
    Object.keys(cross).forEach(function(v) {
        var abi = cross[v];
        if (!abi) {
          var o = data[v];
          if (o.node_abi == 1) {
              abi = 'v8-'+o.v8;
          } else {
              abi = 'node-v'+o.node_abi;
          }
        } else {
          abi = 'napi-'+abi;
        }
        if (targets[abi] === undefined) {
            targets[abi] = [v];
        } else {
            targets[abi].push(v);
            targets[abi].sort(function(a,b) {
              if (semver.gt(a, b)) {
                return 1;
              }
              return -1;
            });
        }
    });
    fs.writeFileSync('./lib/util/napi_crosswalk.json',JSON.stringify(sortObjectByKey(targets),null,2));
});

var versions = Object.keys(data);
versions.forEach(function(ver) {
    get(ver,function(err,result) {
      if (err) throw err;
      cross[ver] = result;
    });
});
