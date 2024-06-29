'use strict';

const path = require('path');
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

test('should throw when custom node target is not found in abi_crosswalk file', (t) => {
  try {
    versioning.get_runtime_abi('node', '123456789.0.0');
  } catch (e) {
    const expectedMessage = 'Unsupported target version: 123456789.0.0';
    t.equal(e.message, expectedMessage);
    t.end();
  }
});

test('should throw when custom node target is not semver', (t) => {
  try {
    versioning.get_runtime_abi('node', '1.2.3.4');
  } catch (e) {
    const expectedMessage = 'Unknown target version: 1.2.3.4';
    t.equal(e.message, expectedMessage);
    t.end();
  }
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
  const expected_libc_token = detect_libc.familySync() || 'unknown';
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
    const opts = versioning.evaluate(mock_package_json, { module_root: '/root' });
    t.equal(opts.host, mock_package_json.binary.host + '/');
    t.equal(opts.hosted_path, mock_package_json.binary.host + '/');
    t.equal(opts.hosted_tarball, mock_package_json.binary.host + '/' + opts.package_name);
  } catch (e) {
    t.ifError(e, 'staging_host and production_host should be silently ignored');
  }

  t.end();
});

test('should replace "-" with "_" in custom binary host', (t) => {
  const mock_package_json = {
    name: 'test',
    main: 'test.js',
    version: '0.1.0',
    binary: {
      module_name: 'canvas-prebuilt',
      module_path: 'build/Release',
      host: 'https://github.com/node-gfx/node-canvas-prebuilt/releases/download/',
      remote_path: 'v{version}',
      package_name: '{module_name}-v{version}-{node_abi}-{platform}-{libc}-{arch}.tar.gz'
    }
  };

  process.env.npm_config_canvas_prebuilt_binary_host_mirror = 'https://npm.taobao.org/mirrors/node-canvas-prebuilt/';
  const opts = versioning.evaluate(mock_package_json, {});
  t.equal(opts.host, 'https://npm.taobao.org/mirrors/node-canvas-prebuilt/');
  delete process.env.npm_config_canvas_prebuilt_binary_host_mirror;
  t.end();
});

