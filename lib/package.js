
module.exports = exports = _package;

exports.usage = 'Packs binary (and enclosing directory) into locally staged tarball';

const fs = require('fs');
const path = require('path');
const log = require('npmlog');
const versioning = require('./util/versioning.js');
const napi = require('./util/napi.js');
const existsAsync = fs.exists || path.exists;
const mkdirp = require('mkdirp');
const tar = require('tar');

function _package(gyp, argv, callback) {
  const packlist = require('npm-packlist');
  const package_json = gyp.package_json;
  const napi_build_version = napi.get_napi_build_version_from_command_args(argv);
  const opts = versioning.evaluate(package_json, gyp.opts, napi_build_version);
  const from = opts.module_path;
  const binary_module = path.join(from, opts.module_name + '.node');
  existsAsync(binary_module, (found) => {
    if (!found) {
      return callback(new Error('Cannot package because ' + binary_module + ' missing: run `node-pre-gyp rebuild` first'));
    }
    const tarball = opts.staged_tarball;
    const filter_func = function(entry) {
      // ensure directories are +x
      // https://github.com/mapnik/node-mapnik/issues/262
      log.info('package', 'packing ' + entry.path);
      return true;
    };
    mkdirp(path.dirname(tarball), (err) => {
      if (err) return callback(err);
      packlist({ path: from }).then((files) => {
        const base = path.basename(from);
        files = files.map((file) => {
          return path.join(base, file);
        });
        tar.create({
          portable: true,
          gzip: true,
          onentry: filter_func,
          file: tarball,
          cwd: path.dirname(from)
        }, files, (err2) => {
          if (err2)  console.error('[' + package_json.name + '] ' + err2.message);
          else log.info('package', 'Binary staged at "' + tarball + '"');
          return callback(err2);
        });
      }, callback);
    });
  });
}
