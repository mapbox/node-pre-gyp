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


const all_commands = ['build', 'clean', 'configure', 'info', 'install', 'package', 'publish', 'rebuild',
  'reinstall', 'reveal', 'testbinary', 'testpackage', 'unpublish'];

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

test('should set staging and production hosts', (t) => {
  // make sure it's good when specifying host.
  const mock_package_json = makePackageJson();

  let { prog } = setupTest(dir, mock_package_json);
  t.deepEqual(prog.package_json, mock_package_json);
  t.equal(prog.binaryHostSet, false, 'binary host should not be flagged as set');

  // test with no s3_host option
  all_commands.forEach((cmd) => {
    const mpj = clone(mock_package_json);
    mpj.binary.host = '';
    const opts = { argv: [cmd] };
    ({ prog } = setupTest(dir, mpj, opts));
    mpj.binary.host = (cmd === 'publish' || cmd === 'unpublish') ? mpj.binary.staging_host : mpj.binary.production_host;
    t.deepEqual(prog.package_json, mpj, 'host should be correct for command: ' + cmd);
    t.equal(prog.binaryHostSet, true, 'binary host should be flagged as set');
  });

  // test with s3_host set to staging
  all_commands.forEach((cmd) => {
    const mpj = clone(mock_package_json);
    mpj.binary.host = '';
    const opts = { argv: [cmd, '--s3_host=staging'] };
    ({ prog } = setupTest(dir, mpj, opts));
    mpj.binary.host = mpj.binary.staging_host;
    t.deepEqual(prog.package_json, mpj, 'host should be correct for command: ' + cmd);
    t.equal(prog.binaryHostSet, true, 'binary host should be flagged as set');
  });

  // test with s3_host set to production
  all_commands.forEach((cmd) => {
    const mpj = clone(mock_package_json);
    mpj.binary.host = '';
    const opts = { argv: [cmd, '--s3_host=production'] };
    ({ prog } = setupTest(dir, mpj, opts));
    mpj.binary.host = mpj.binary.production_host;
    t.deepEqual(prog.package_json, mpj, 'host should be correct for command: ' + cmd);
    t.equal(prog.binaryHostSet, true, 'binary host should be flagged as set');
  });

  t.end();
});

test('should execute setBinaryHostProperty() properly', (t) => {
  // it only --s3_host only takes effect if host is falsey.
  const mock_package_json = makePackageJson({ binary: { host: '' } });

  const opts = { argv: ['publish', '--s3_host=staging'] };

  let { prog, binaryHost } = setupTest(dir, mock_package_json, opts);
  t.equal(binaryHost, mock_package_json.binary.staging_host);

  // set it again to verify that it returns the already set value
  binaryHost = prog.setBinaryHostProperty('publish');
  t.equal(binaryHost, mock_package_json.binary.staging_host);

  // now do this again but expect an empty binary host value because
  // staging_host is missing.
  const mpj = clone(mock_package_json);
  delete mpj.binary.staging_host;
  ({ prog, binaryHost } = setupTest(dir, mpj, opts));
  t.equal(binaryHost, '');

  // one more time but with an invalid value for s3_host
  opts.argv = ['publish', '--s3_host=bad-news'];
  try {
    ({ prog, binaryHost } = setupTest(dir, mock_package_json, opts));
    t.fail('should throw with --s3_host=bad-news');
  } catch (e) {
    t.equal(e.message, 'invalid s3_host bad-news');
  }

  t.end();
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

// helper to write package.json to disk so Run() can be instantiated with it.
function setupTest(directory, package_json, opts) {
  opts = opts || {};
  let argv = ['node', 'program'];
  if (opts.argv) {
    argv = argv.concat(opts.argv);
  }
  const prev_dir = process.cwd();
  if (!opts.noChdir) {
    try {
      fs.mkdirSync(directory);
    } catch (e) {
      if (e.code !== 'EEXIST') {
        throw e;
      }
    }
    process.chdir(directory);
  }

  try {
    fs.writeFileSync('package.json', JSON.stringify(package_json));
    const prog = new npg.Run({ package_json_path: './package.json', argv });
    const binaryHost = prog.setBinaryHostProperty(prog.todo[0] && prog.todo[0].name);
    return { prog, binaryHost };
  } finally {
    process.chdir(prev_dir);
  }
}

// helper to clone mock package.json. it's overkill for existing tests
// but is future-proof.
// https://stackoverflow.com/questions/4459928/how-to-deep-clone-in-javascript
function clone(obj, hash = new WeakMap()) {
  if (Object(obj) !== obj) return obj;      // primitives
  if (hash.has(obj)) return hash.get(obj);  // cyclic reference
  let result;

  if (obj instanceof Set) {
    result = new Set(obj);                  // treat set as a value
  } else if (obj instanceof Map) {
    result = new Map(Array.from(obj, ([key, val]) => [key, clone(val, hash)]));
  } else if (obj instanceof Date) {
    result = new Date(obj);
  } else if (obj instanceof RegExp) {
    result = new RegExp(obj.source, obj.flags);
  } else if (obj.constructor) {
    result = new obj.constructor();
  } else {
    result = Object.create(null);
  }
  hash.set(obj, result);
  return Object.assign(result, ...Object.keys(obj).map((key) => {
    return { [key]: clone(obj[key], hash) };
  }));
}

