'use strict';

const fs = require('fs');
const path = require('path');
const npg = require('../lib/node-pre-gyp.js');
const versioning = require('../lib/util/versioning.js');
const test = require('tape');
const detect_libc = require('detect-libc');

test('should normalize double slash', (t) => {
  const mock_package_json = {
    'name': 'test',
    'main': 'test.js',
    'version': '0.1.0',
    'binary': {
      'module_name': 'test',
      'module_path': './lib/binding/{configuration}/{toolset}/{name}',
      'remote_path': './{name}/v{version}/{configuration}/{version}/{toolset}/',
      'package_name': '{module_name}-v{major}.{minor}.{patch}-{prerelease}+{build}-{toolset}-{node_abi}-{platform}-{arch}.tar.gz',
      'host': 'https://some-bucket.s3.us-east-1.amazonaws.com'
    }
  };
  const opts = versioning.evaluate(mock_package_json, {});
  t.equal(opts.remote_path, './test/v0.1.0/Release/0.1.0/');
  // Node v0.11.x on windows lowercases C:// when path.join is called
  // https://github.com/joyent/node/issues/7031
  t.equal(path.normalize(opts.module_path), path.join(process.cwd(), 'lib/binding/Release/test'));
  const opts_toolset = versioning.evaluate(mock_package_json, { toolset: 'custom-toolset' });
  t.equal(opts_toolset.remote_path, './test/v0.1.0/Release/0.1.0/custom-toolset/');
  t.end();
});

test('should detect abi for node process', (t) => {
  const mock_process_versions = {
    node: '0.10.33',
    v8: '3.14.5.9',
    modules: '11'
  };
  const abi = versioning.get_node_abi('node', mock_process_versions);
  t.equal(abi, 'node-v11');
  t.equal(versioning.get_runtime_abi('node', undefined), versioning.get_node_abi('node', process.versions));
  t.end();
});

test('should detect abi for odd node target', (t) => {
  const mock_process_versions = {
    node: '0.11.1000000',
    modules: 'bogus'
  };
  const abi = versioning.get_node_abi('node', mock_process_versions);
  t.equal(abi, 'node-v0.11.1000000');
  t.end();
});

test('should detect abi for custom node target', (t) => {
  const mock_process_versions = {
    'node': '0.10.0',
    'modules': '11'
  };
  t.equal(versioning.get_runtime_abi('node', '0.10.0'), versioning.get_node_abi('node', mock_process_versions));
  const mock_process_versions2 = {
    'node': '0.8.0',
    'v8': '3.11'
  };
  t.equal(versioning.get_runtime_abi('node', '0.8.0'), versioning.get_node_abi('node', mock_process_versions2));
  t.end();
});

test('should detect runtime for node-webkit and electron', (t) => {
  const mock_process_versions = {
    'electron': '0.37.3'
  };
  t.equal(versioning.get_process_runtime(mock_process_versions), 'electron');
  const mock_process_versions2 = {
    'node': '0.8.0'
  };
  t.equal(versioning.get_process_runtime(mock_process_versions2), 'node');
  const mock_process_versions3 = {
    'node-webkit': '0.37.3'
  };
  t.equal(versioning.get_process_runtime(mock_process_versions3), 'node-webkit');
  t.end();
});

test('should detect abi for electron runtime', (t) => {
  t.equal(versioning.get_runtime_abi('electron', '0.37.3'), versioning.get_electron_abi('electron', '0.37.3'));
  t.end();
});

test('should detect abi for node-webkit runtime', (t) => {
  t.equal(versioning.get_runtime_abi('node-webkit', '0.10.5'), versioning.get_node_webkit_abi('node-webkit', '0.10.5'));
  t.end();
});

test('should detect custom binary host from env', (t) => {
  const mock_package_json = {
    'name': 'test',
    'main': 'test.js',
    'version': '0.1.0',
    'binary': {
      'module_name': 'test',
      'module_path': './lib/binding/{configuration}/{toolset}/{name}',
      'remote_path': './{name}/v{version}/{configuration}/{version}/{toolset}/',
      'package_name': '{module_name}-v{major}.{minor}.{patch}-{prerelease}+{build}-{toolset}-{node_abi}-{platform}-{arch}.tar.gz',
      'host': 'https://some-bucket.s3.us-east-1.amazonaws.com'
    }
  };
  // mock npm_config_test_binary_host_mirror env
  process.env.npm_config_test_binary_host_mirror = 'https://npm.taobao.org/mirrors/node-inspector/';
  const opts = versioning.evaluate(mock_package_json, {});
  t.equal(opts.host, 'https://npm.taobao.org/mirrors/node-inspector/');
  delete process.env.npm_config_test_binary_host_mirror;
  t.end();
});

test('should detect libc', (t) => {
  const mock_package_json = {
    'name': 'test',
    'main': 'test.js',
    'version': '0.1.0',
    'binary': {
      'module_name': 'test',
      'module_path': './lib/binding/{name}-{libc}',
      'remote_path': './{name}/{libc}/',
      'package_name': '{module_name}-{libc}.tar.gz',
      'host': 'https://some-bucket.s3-us-west-1.amazonaws.com'
    }
  };
  const opts = versioning.evaluate(mock_package_json, { module_root: '/root' });
  const expected_libc_token = detect_libc.family || 'unknown';
  t.comment('performing test with the following libc token: ' + expected_libc_token);
  t.equal(opts.module_path, path.normalize('/root/lib/binding/test-' + expected_libc_token));
  t.equal(opts.module, path.normalize('/root/lib/binding/test-' + expected_libc_token + '/test.node'));
  t.equal(opts.remote_path, './test/' + expected_libc_token + '/');
  t.equal(opts.package_name, 'test-' + expected_libc_token + '.tar.gz');
  t.equal(opts.hosted_tarball, 'https://some-bucket.s3-us-west-1.amazonaws.com/test/' + expected_libc_token + '/test-' + expected_libc_token + '.tar.gz');
  t.end();
});

//
// validate package.json versioning configurations
//
test('should verify that package.json has required properties', (t) => {
  const mock_package_json = {
    'name': 'test',
    'main': 'test.js',
    'version': '0.1.0',
    'binary': {
      'module_name': 'binary-module-name',
      'module_path': 'binary-module-path',
      'host': 'binary-path'
    }
  };
  const requireds = Object.keys(mock_package_json);

  for (let i = 0; i < requireds.length; i++) {
    const package_json = Object.assign({}, mock_package_json);
    delete package_json[requireds[i]];
    const missing = [requireds[i]];

    try {
      // eslint-disable-next-line no-unused-vars
      const opts = versioning.evaluate(package_json, { module_root: '/root' });
    } catch (e) {
      // name won't be there if it's missing but both messages say 'undefined'
      const msg = package_json.name + ' package.json is not node-pre-gyp ready:\n';
      const expectedMessage = msg + 'package.json must declare these properties: \n' + missing.join('\n');
      t.equal(e.message, expectedMessage);
    }
  }
  t.end();
});

test('should verify that the binary property has required properties', (t) => {
  const mock_package_json = {
    'name': 'test',
    'main': 'test.js',
    'version': '0.1.0',
    'binary': {
      'module_name': 'binary-module-name',
      'module_path': 'binary-module-path',
      'host': 'binary-path'
    }
  };
  const requireds = Object.keys(mock_package_json.binary);

  for (let i = 0; i < requireds.length; i++) {
    const package_json = Object.assign({}, mock_package_json);
    package_json.binary = Object.assign({}, mock_package_json.binary);

    delete package_json.binary[requireds[i]];
    const missing = ['binary.' + requireds[i]];

    try {
      // eslint-disable-next-line no-unused-vars
      const opts = versioning.evaluate(package_json, { module_root: '/root' });
    } catch (e) {
      // name won't be there if it's missing but both messages say 'undefined'
      const msg = package_json.name + ' package.json is not node-pre-gyp ready:\n';
      const expectedMessage = msg + 'package.json must declare these properties: \n' + missing.join('\n');
      t.equal(e.message, expectedMessage);
    }
  }
  t.end();
});

test('should verify host overrides staging and production values', (t) => {
  const mock_package_json = {
    name: 'test',
    main: 'test.js',
    version: '0.1.0',
    binary: {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      host: 'binary-path',
      staging_host: 's3-staging-path',
      production_host: 's3-production-path'
    }
  };

  try {
    // eslint-disable-next-line no-unused-vars
    const opts = versioning.evaluate(mock_package_json, { module_root: '/root' });
    t.equal(opts.host, mock_package_json.binary.host + '/');
    t.equal(opts.hosted_path, mock_package_json.binary.host + '/');
    t.equal(opts.hosted_tarball, mock_package_json.binary.host + '/' + opts.package_name);
  } catch (e) {
    t.ifError(e, 'staging_host and production_host should be silently ignored');
  }

  t.end();
});

const dir = '.tmp';

test('should set staging and production hosts', (t) => {
  // make sure it's good when specifying host.
  const mock_package_json = {
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

  let { prog } = setupTest(dir, mock_package_json);
  t.deepEqual(prog.package_json, mock_package_json);
  t.equal(prog.binaryHostSet, false, 'binary host should not be flagged as set');

  const all_commands = ['build', 'clean', 'configure', 'info', 'install', 'package', 'publish', 'rebuild',
    'reinstall', 'reveal', 'testbinary', 'testpackage', 'unpublish'];

  // test with no s3_host option
  all_commands.forEach((cmd) => {
    const mpj = clone(mock_package_json);
    mpj.binary.host = '';
    const opts = { argv: [cmd] };
    ({ prog } = setupTest(dir, mpj, opts));
    mpj.binary.host = cmd === 'publish' ? mpj.binary.staging_host : mpj.binary.production_host;
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
  const mock_package_json = {
    'name': 'test',
    'main': 'test.js',
    'version': '0.1.0',
    'binary': {
      'module_name': 'binary-module-name',
      'module_path': 'binary-module-path',
      'host': '',
      'staging_host': 's3-staging-path',
      'production_host': 's3-production-path'
    }
  };
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
        new npg.Run(dir + '/package.json');
        t.fail('new Run() should have thrown');
      } catch (e) {
        t.equal(e.message, "ENOENT: no such file or directory, open '.tmp/package.json'");
      }
      t.end();
    });
  });
});

// clean up after the s3_host tests.
test.onFinish(() => {
  try {
    fs.unlinkSync(dir + '/package.json');
  } catch (e) {
    // empty blocks are not allowed.
  }

  try {
    fs.rmdirSync(dir);
  } catch (e) {
    //
  }
});

//
// test helpers.
//

// helper to write package.json to disk so Run() can be instantiated with it.
function setupTest(directory, package_json, opts) {
  opts = opts || {};
  let argv = ['node', 'program'];
  if (opts.argv) {
    argv = argv.concat(opts.argv);
  }
  const prev_dir = process.cwd();
  try {
    fs.mkdirSync(directory);
  } catch (e) {
    if (e.code !== 'EEXIST') {
      throw e;
    }
  }
  process.chdir(directory);

  try {
    fs.writeFileSync('package.json', JSON.stringify(package_json));
    const prog = new npg.Run('./package.json');
    prog.parseArgv(argv);
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
