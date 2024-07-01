'use strict';

/**
 * test that executing node_pre_gyp.run() works as expected with various
 * configurations and command line options.
 */

const fs = require('fs');
const path = require('path');

const { rimraf } = require('rimraf');

const npg = require('../lib/node-pre-gyp.js');
const test = require('tape');

const dir = 'tmp';

const package_json_template = {
  'name': 'test',
  'main': 'test.js',
  'version': '0.1.0',
  'binary': {
    'module_name': 'binary-module-name',
    'module_path': 'binary-module-path',
    'host': 'binary-path',
    'staging_host': 's3-staging-path',
    'production_host': 's3-production-path'
  }
};

/**
 * before testing create a scratch directory to run tests in.
 */
const orig_dir = process.cwd();
const scratch = path.resolve('./scratch');

// execute this as a test so it doesn't change the working directory while the
// previous test (fetch.test.js) is running.
test('setup', (t) => {
  try {
    fs.mkdirSync(scratch);
  } catch (e) {
    if (e.code !== 'EEXIST') {
      throw e;
    }
  }
  try {
    fs.mkdirSync(path.join(scratch, dir));
  } catch (e) {
    if (e.code !== 'EEXIST') {
      throw e;
    }
  }
  // cleanup any previous test settings.
  delete process.env.node_pre_gyp_s3_host;

  process.chdir(scratch);
  t.end();
});

test.onFinish(() => {
  process.chdir(orig_dir);
  rimraf(scratch).then(() => undefined, () => undefined);
});

test('verify that the --directory option works', (t) => {
  const initial = process.cwd();

  // make each unique so it can't match a leftover file (shouldn't happen, but...)
  let mock_package_json = makePackageJson({ binary: { host: 'xyzzy' } });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(mock_package_json));
  let argv = ['node', 'program', 'publish', `--directory=${dir}`];
  let prog = new npg.Run({ package_json_path: './package.json', argv });
  t.deepEqual(prog.package_json, mock_package_json, 'should work with the directory option');
  t.equal(process.cwd(), initial, 'the directory should be unchanged after executing');

  mock_package_json = makePackageJson({ binary: { host: '42' } });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(mock_package_json));
  argv = ['node', 'program', 'publish'];
  prog = new npg.Run({ package_json_path: `${path.join(dir, 'package.json')}`, argv });
  t.deepEqual(prog.package_json, mock_package_json, 'should work without changing the directory');
  t.equal(process.cwd(), initial, 'the directory should be unchanged after executing');

  const badDir = '/xyzzy/fubar';
  argv = ['node', 'program', 'publish', `--directory=${badDir}`];
  try {
    prog = new npg.Run({ package_json_path: 'package.json', argv });
    t.fail(`should not find package.json in ${badDir}`);
  } catch (e) {
    const exist = e.message.indexOf('ENOENT: no such file or directory');
    t.equal(exist, 0);
  }
  t.equal(process.cwd(), initial, 'the directory should be unchanged after failing');

  t.end();
});


test('verify that the --directory works with napi_versions', (t) => {
  const initial = process.cwd();

  // make each unique so it can't match a leftover file (shouldn't happen, but...)
  let mock_package_json = makePackageJson({ binary: { host: 'xyzzy', napi_versions: [1, 4] } });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(mock_package_json));
  let argv = ['node', 'program', 'publish', `--directory=${dir}`];
  let prog = new npg.Run({ package_json_path: './package.json', argv });
  t.deepEqual(prog.package_json, mock_package_json, 'should work with the directory option');
  t.equal(process.cwd(), initial, 'the directory should be unchanged after executing');

  mock_package_json = makePackageJson({ binary: { host: '42', napi_versions: [1, 4] } });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(mock_package_json));
  argv = ['node', 'program', 'publish'];
  prog = new npg.Run({ package_json_path: `${path.join(dir, 'package.json')}`, argv });
  t.deepEqual(prog.package_json, mock_package_json, 'should work without changing the directory');
  t.equal(process.cwd(), initial, 'the directory should be unchanged after executing');

  t.end();
});

test('verify that a non-existent package.json fails', (t) => {
  fs.unlink(dir + '/package.json', (e0) => {
    if (e0 && e0.code !== 'ENOENT') {
      console.error(e0.message);
    }
    // ignore errors
    fs.rmdir(dir, (e1) => {
      if (e1 && e1.code !== 'ENOENT') {
        console.error(e1.message);
      }
      try {
        new npg.Run({ package_json_path: dir + '/package.json' });
        t.fail('new Run() should have thrown');
      } catch (e) {
        const exist = e.message.indexOf('ENOENT: no such file or directory');
        t.equal(exist, 0);
      }
      t.end();
    });
  });
});

//
// test helpers.
//

// helper to clone mock package.json.
// // https://stackoverflow.com/questions/4459928/how-to-deep-clone-in-javascript
const clone = (obj) => JSON.parse(JSON.stringify(obj));

function makePackageJson(options = {}) {
  const package_json = clone(package_json_template);
  // override binary values if supplied
  if (options.binary) {
    for (const k in options.binary) {
      package_json.binary[k] = options.binary[k];
    }
  }
  return package_json;
}
