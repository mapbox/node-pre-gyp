'use strict';

const getPrevious = require('./target_version.util.js');
const run = require('./run.util.js');
const abi_crosswalk = require('../lib/util/abi_crosswalk.json');
const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('tape');

test('should properly calculate previous version', (t) => {
  t.equal(getPrevious('1.0.0', abi_crosswalk), undefined);
  t.equal(getPrevious('1.0.1', abi_crosswalk), '1.0.0');
  t.equal(getPrevious('1.0.2', abi_crosswalk), '1.0.1');
  t.end();
});

/*

Context:

node-pre-gyp can "cross-install" which means that you can install binaries for a given node version that is
different than the node version you are running. This is possible by passing the `--target` flag with a value
for a given node version you want to target like `--target=4.3.4`.

Internally node-pre-gyp will take this version (4.3.4), figure out the ABI version for it (aka `process.versions.modules`)
and then install the right binary.

*/

// Get all major values for released node versions we know about
const versions = [];
Object.keys(abi_crosswalk).forEach((v) => {
  const major = +v.split('.')[0];
  // console.log(major)
  if (!(versions.indexOf(major) > -1)) {
    versions.push(major);
  }
});

test('every major version should have a unique ABI that is consistent across all major versions', (t) => {
  const abis = {};
  Object.keys(abi_crosswalk).forEach((v) => {
    const major = +v.split('.')[0];
    if (major >= 2) {
      const o = abi_crosswalk[v];
      if (!abis[major]) {
        abis[major] = o.node_abi;
      } else {
        t.equal(abis[major], o.node_abi, v + ' should have abi: ' + o.node_abi);
      }
    }
  });
  t.end();
});

let found = false;
const current_version = process.versions.node;
const major = +(current_version.split('.')[0]);

test('ensure crosswalk has major version of current node', (t) => {
  found = versions.indexOf(major) > -1;
  t.ok(found);
  t.end();
});

/*
If we know:

 - the current version is in the crosswalk
 - it has a previous patch version (it is at least x.x.1)
 - and that x.x.1 has been released

Then we test the --target flag by:

  - pretending current version is the previous version
  - the current version does not exist in the abi_crosswalk (by mocking it)
*/

const previous_patch_version = getPrevious(current_version, abi_crosswalk);

if (previous_patch_version && previous_patch_version !== current_version) {

  const app = { 'name': 'app1', 'args': '' };

  test(app.name + ' builds with custom --target=' + previous_patch_version + ' that is greater than known version in ABI crosswalk ' + app.args, (t) => {
    if (found) {
      // construct a mock abi_crosswalk that contains only the previous node version
      // and not the current node version
      const target_abi = {};
      target_abi[previous_patch_version] = abi_crosswalk[previous_patch_version];
      // write this crosswalk to disk
      const testing_crosswalk = path.join(os.tmpdir(), 'fake_abi_crosswalk.json');
      fs.writeFileSync(testing_crosswalk, JSON.stringify(target_abi));
      // pass mock crosswalk to env so that the node-pre-gyp we shell out to
      // uses the mock crosswalk
      const new_env = JSON.parse(JSON.stringify(process.env));
      new_env.NODE_PRE_GYP_ABI_CROSSWALK = testing_crosswalk;
      const opts = { env: new_env };
      run('node-pre-gyp', 'rebuild', '--build-from-source --fallback-to-build --target=' + previous_patch_version, app, opts, (err, stdout) => {
        t.ifError(err);
        t.notEqual(stdout, '');
        // For some reason there is no stderr starting with node v14
        // t.notEqual(stderr, '');
        run('node-pre-gyp', 'clean', '--target=' + current_version, app, opts, (err2, stdout2) => {
          t.ifError(err2);
          t.notEqual(stdout2, '');
          // For some reason there is no stderr starting with node v14
          // t.notEqual(stderr2, '');
          t.end();
        });
      });
    }
  });
}

