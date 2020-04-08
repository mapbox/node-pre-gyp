"use strict";

module.exports = exports = _package;

exports.usage = 'Packs binary (and enclosing directory) into locally staged tarball';

var fs = require('fs');
var path = require('path');
var log = require('npmlog');
var versioning = require('./util/versioning.js');
var napi = require('./util/napi.js');
var write = require('fs').createWriteStream;
var existsAsync = fs.exists || path.exists;
var mkdirp = require('mkdirp');
var tar = require('tar');
var path = require('path');

function readdirSync(dir) {
  var list = [];
  var files = fs.readdirSync(dir);

  files.forEach(function (file) {
    var stats = fs.lstatSync(path.join(dir, file));
    if(stats.isDirectory()) {
      list = list.concat(readdirSync(path.join(dir, file)));
    } else {
      list.push(path.join(dir,file));
    }
  });
  return list;
}

function _package(gyp, argv, callback) {
    var package_json = JSON.parse(fs.readFileSync('./package.json'));
    var napi_build_version = napi.get_napi_build_version_from_command_args(argv);
    var opts = versioning.evaluate(package_json, gyp.opts, napi_build_version);
    var from = opts.module_path;
    var binary_module = path.join(from,opts.module_name + '.node');
    existsAsync(binary_module,function(found) {
        if (!found) {
            return callback(new Error("Cannot package because " + binary_module + " missing: run `node-pre-gyp rebuild` first"));
        }
        var tarball = opts.staged_tarball;
        var filter_func = function(entry) {
            var basename = path.basename(entry);
            if (basename.length && basename[0] !== '.') {
              console.log('packing ' + entry);
              return true;
            } else {
              console.log('skipping ' + entry);
            }
            return false;
        };
        mkdirp(path.dirname(tarball),function(err) {
            if (err) return callback(err);
            var files = readdirSync(from);
            var base = path.basename(from);
            files = files.map(function(file) {
                return path.join(base,path.relative(from,file));
            });
            tar.create({
                portable: false,
                gzip: true,
                filter: filter_func,
                file: tarball,
                cwd: path.dirname(from)
            }, files, function(err) {
                if (err)  console.error('['+package_json.name+'] ' + err.message);
                else log.info('package','Binary staged at "' + tarball + '"');
                return callback(err);
            });
        });
    });
}
