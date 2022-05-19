'use strict';

const path = require('path');
const versioning = require('../lib/util/versioning.js');
const test = require('tape');
const detect_libc = require('detect-libc');

/* versioning */

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
    node: '0.10.0',
    modules: '11'
  };
  t.equal(versioning.get_runtime_abi('node', '0.10.0'), versioning.get_node_abi('node', mock_process_versions));
  const mock_process_versions2 = {
    node: '0.8.0',
    v8: '3.11'
  };
  t.equal(versioning.get_runtime_abi('node', '0.8.0'), versioning.get_node_abi('node', mock_process_versions2));
  t.end();
});

test('should detect runtime for node-webkit and electron', (t) => {
  const mock_process_versions = {
    electron: '0.37.3'
  };
  t.equal(versioning.get_process_runtime(mock_process_versions), 'electron');
  const mock_process_versions2 = {
    node: '0.8.0'
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
  const parsed_package_json = {
    name: 'test',
    main: 'test.js',
    version: '0.1.0',
    binary: {
      module_name: 'test',
      module_path: './lib/binding/{configuration}/{toolset}/{name}',
      remote_path: './{name}/v{version}/{configuration}/{version}/{toolset}/',
      package_name: '{module_name}-v{major}.{minor}.{patch}-{prerelease}+{build}-{toolset}-{node_abi}-{platform}-{arch}.tar.gz',
      host: 'https://some-bucket.s3.us-east-1.amazonaws.com'
    }
  };
  // mock npm_config_test_binary_host_mirror env
  process.env.npm_config_test_binary_host_mirror = 'https://registry.npmmirror.com/node-inspector/';
  const cloned = JSON.parse(JSON.stringify(parsed_package_json));
  const opts = versioning.evaluate(cloned, {});

  t.equal(opts.host, 'https://npm.taobao.org/mirrors/node-inspector/');

  delete process.env.npm_config_test_binary_host_mirror;
  t.end();
});

test('should detect libc', (t) => {
  const parsed_package_json = {
    name: 'test',
    main: 'test.js',
    version: '0.1.0',
    binary: {
      module_name: 'test',
      module_path: './lib/binding/{name}-{libc}',
      remote_path: './{name}/{libc}/',
      package_name: '{module_name}-{libc}.tar.gz',
      host: 'https://some-bucket.s3-us-west-1.amazonaws.com'
    }
  };
  const cloned = JSON.parse(JSON.stringify(parsed_package_json));
  const opts = versioning.evaluate(cloned, { module_root: '/root' });
  const expected_libc_token = detect_libc.familySync() || 'unknown';

  t.comment('performing test with the following libc token: ' + expected_libc_token);
  t.equal(opts.module_path, path.normalize('/root/lib/binding/test-' + expected_libc_token));
  t.equal(opts.module, path.normalize('/root/lib/binding/test-' + expected_libc_token + '/test.node'));
  t.equal(opts.remote_path, './test/' + expected_libc_token + '/');
  t.equal(opts.package_name, 'test-' + expected_libc_token + '.tar.gz');
  t.equal(opts.hosted_tarball, 'https://some-bucket.s3-us-west-1.amazonaws.com/test/' + expected_libc_token + '/test-' + expected_libc_token + '.tar.gz');
  t.end();
});

/* package.json verification */

test('should verify that package.json has required properties', (t) => {
  const parsed_package_json = {
    name: 'test',
    main: 'test.js',
    version: '0.1.0',
    binary: {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      host: 'binary-path'
    }
  };
  const requireds = Object.keys(parsed_package_json);

  for (let i = 0; i < requireds.length; i++) {
    const cloned = JSON.parse(JSON.stringify(parsed_package_json));
    delete cloned[requireds[i]];
    const missing = [requireds[i]];

    try {
      // eslint-disable-next-line no-unused-vars
      const opts = versioning.evaluate(cloned, {});
    } catch (e) {
      // name won't be there if it's missing but both messages say 'undefined'
      const msg = cloned.name + ' package.json is not node-pre-gyp ready:\n';
      const expectedMessage = msg + 'package.json must declare these properties: \n' + missing.join('\n');

      t.equal(e.message, expectedMessage);
    }
  }
  t.end();
});

test('should verify that the binary property has required properties', (t) => {
  const parsed_package_json = {
    name: 'test',
    main: 'test.js',
    version: '0.1.0',
    binary: {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      host: 'binary-path'
    }
  };
  const requireds = Object.keys(parsed_package_json.binary);

  for (let i = 0; i < requireds.length; i++) {
    const cloned = JSON.parse(JSON.stringify(parsed_package_json));
    delete cloned.binary[requireds[i]];
    const missing = ['binary.' + requireds[i]];

    try {
      // eslint-disable-next-line no-unused-vars
      const opts = versioning.evaluate(cloned, {});
    } catch (e) {
      // name won't be there if it's missing but both messages say 'undefined'
      const msg = cloned.name + ' package.json is not node-pre-gyp ready:\n';
      const expectedMessage = msg + 'package.json must declare these properties: \n' + missing.join('\n');

      t.equal(e.message, expectedMessage);
    }
  }
  t.end();
});

test('should verify that the binary.host has required properties', (t) => {
  const parsed_package_json = {
    name: 'test',
    main: 'test.js',
    version: '0.1.0',
    binary: {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      host: {
        endpoint: 'binary-path'
      }
    }
  };
  const requireds = Object.keys(parsed_package_json.binary.host);

  for (let i = 0; i < requireds.length; i++) {
    const cloned = JSON.parse(JSON.stringify(parsed_package_json));
    delete cloned.binary.host[requireds[i]];
    const missing = ['binary.host.' + requireds[i]];

    try {
      // eslint-disable-next-line no-unused-vars
      const opts = versioning.evaluate(cloned, {});
    } catch (e) {
      // name won't be there if it's missing but both messages say 'undefined'
      const msg = cloned.name + ' package.json is not node-pre-gyp ready:\n';
      const expectedMessage = msg + 'package.json must declare these properties: \n' + missing.join('\n');

      t.equal(e.message, expectedMessage);
    }
  }
  t.end();
});

test('should allow production_host to act as alias to host (when host not preset)', (t) => {
  const parsed_package_json = {
    name: 'test',
    main: 'test.js',
    version: '0.1.0',
    binary: {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      production_host: 's3-production-path'
    }
  };

  const cloned = JSON.parse(JSON.stringify(parsed_package_json));
  const opts = versioning.evaluate(cloned, {});

  t.equal(opts.host, parsed_package_json.binary.production_host + '/');
  t.equal(opts.hosted_path, parsed_package_json.binary.production_host + '/');
  t.equal(opts.hosted_tarball, parsed_package_json.binary.production_host + '/' + opts.package_name);
  t.end();
});

test('should use host over production_host (when both are preset)', (t) => {
  const parsed_package_json = {
    name: 'test',
    main: 'test.js',
    version: '0.1.0',
    binary: {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      production_host: 's3-production-path',
      host: 'binary-path'
    }
  };

  let cloned = JSON.parse(JSON.stringify(parsed_package_json));
  let opts = versioning.evaluate(cloned, {});

  t.equal(opts.host, parsed_package_json.binary.host + '/');
  t.equal(opts.hosted_path, parsed_package_json.binary.host + '/');
  t.equal(opts.hosted_tarball, parsed_package_json.binary.host + '/' + opts.package_name);

  // change to object format
  parsed_package_json.binary.host = { endpoint: 'binary-path' };

  cloned = JSON.parse(JSON.stringify(parsed_package_json));
  opts = versioning.evaluate(cloned, {});

  t.equal(opts.host, parsed_package_json.binary.host.endpoint + '/');
  t.equal(opts.hosted_path, parsed_package_json.binary.host.endpoint + '/');
  t.equal(opts.hosted_tarball, parsed_package_json.binary.host.endpoint + '/' + opts.package_name);

  t.end();
});

test('should verify that the host url protocol is https', (t) => {
  const parsed_package_json = {
    name: 'test',
    main: 'test.js',
    version: '0.1.0',
    binary: {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      host: 'http://your_module.s3-us-west-1.amazonaws.com'
    }
  };

  let cloned = JSON.parse(JSON.stringify(parsed_package_json));
  try {
    // eslint-disable-next-line no-unused-vars
    const opts = versioning.evaluate(cloned, {});
  } catch (e) {
    // name won't be there if it's missing but both messages say 'undefined'
    const msg = cloned.name + ' package.json is not node-pre-gyp ready:\n';
    const expectedMessage = msg + '\'host\' protocol (http:) is invalid - only \'https:\' is accepted';

    t.equal(e.message, expectedMessage);
  }

  // change to object format
  parsed_package_json.binary.host = { endpoint: 'binary-path' };
  cloned = JSON.parse(JSON.stringify(parsed_package_json));
  try {
    // eslint-disable-next-line no-unused-vars
    const opts = versioning.evaluate(cloned, {});
  } catch (e) {
    // name won't be there if it's missing but both messages say 'undefined'
    const msg = cloned.name + ' package.json is not node-pre-gyp ready:\n';
    const expectedMessage = msg + '\'host\' protocol (http:) is invalid - only \'https:\' is accepted';

    t.equal(e.message, expectedMessage);
  }

  t.end();
});

test('should verify that alternate hosts url protocol is https', (t) => {
  const parsed_package_json = {
    name: 'test',
    main: 'test.js',
    version: '0.1.0',
    binary: {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      host: 'https://your_module.s3-us-west-1.amazonaws.com'
    }
  };

  const hosts = ['production', 'staging', 'development'];
  hosts.forEach((host) => {
    const cloned = JSON.parse(JSON.stringify(parsed_package_json));
    cloned[`${host}_host`] = `http://${host}_bucket.s3-us-west-1.amazonaws.com`;

    try {
      // eslint-disable-next-line no-unused-vars
      const opts = versioning.evaluate(cloned, {});
    } catch (e) {
      // name won't be there if it's missing but both messages say 'undefined'
      const msg = cloned.name + ' package.json is not node-pre-gyp ready:\n';
      const expectedMessage = msg + `'${host}_host' protocol (http:) is invalid - only 'https:' is accepted`;

      t.equal(e.message, expectedMessage);
    }
  });

  hosts.forEach((host) => {
    // change to object format
    const cloned = JSON.parse(JSON.stringify(parsed_package_json));
    cloned.binary[`${host}_host`] = { endpoint: `http://${host}_bucket.s3-us-west-1.amazonaws.com` };

    try {
      // eslint-disable-next-line no-unused-vars
      const opts = versioning.evaluate(cloned, {});
    } catch (e) {
      // name won't be there if it's missing but both messages say 'undefined'
      const msg = cloned.name + ' package.json is not node-pre-gyp ready:\n';
      const expectedMessage = msg + `'${host}_host' protocol (http:) is invalid - only 'https:' is accepted`;

      t.equal(e.message, expectedMessage);
    }
  });

  t.end();
});

/* host options */

test('should use host key by default for install, info, publish and unpublish commands (when no other hosts specified)', (t) => {
  const makeOoptions = (cmd) => {
    return {
      argv: {
        remain: [cmd],
        cooked: [cmd],
        original: [cmd]
      }
    };
  };

  const parsed_package_json = {
    name: 'test',
    main: 'test.js',
    version: '0.1.0',
    binary: {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      host: 'binary-path'
    }
  };

  const cmds = ['install', 'info', 'publish', 'unpublish'];
  cmds.forEach((cmd) => {
    const cloned = JSON.parse(JSON.stringify(parsed_package_json));
    const opts = versioning.evaluate(cloned, makeOoptions(cmd));

    t.equal(opts.host, parsed_package_json.binary.host + '/');
    t.equal(opts.hosted_path, parsed_package_json.binary.host + '/');
    t.equal(opts.hosted_tarball, parsed_package_json.binary.host + '/' + opts.package_name);
  });
  cmds.forEach((cmd) => {
    // change to object format
    parsed_package_json.binary.host = { endpoint: 'binary-path' };
    const cloned = JSON.parse(JSON.stringify(parsed_package_json));
    const opts = versioning.evaluate(cloned, makeOoptions(cmd));

    t.equal(opts.host, parsed_package_json.binary.host.endpoint + '/');
    t.equal(opts.hosted_path, parsed_package_json.binary.host.endpoint + '/');
    t.equal(opts.hosted_tarball, parsed_package_json.binary.host.endpoint + '/' + opts.package_name);
  });
  t.end();
});

test('should use production_host as alias for host for install and info commands (when host not preset)', (t) => {
  const makeOoptions = (cmd) => {
    return {
      argv: {
        remain: [cmd],
        cooked: [cmd],
        original: [cmd]
      }
    };
  };

  const parsed_package_json = {
    name: 'test',
    main: 'test.js',
    version: '0.1.0',
    binary: {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      production_host: 's3-production-path'
    }
  };

  const cmds = ['install', 'info'];
  cmds.forEach((cmd) => {
    const cloned = JSON.parse(JSON.stringify(parsed_package_json));
    const opts = versioning.evaluate(cloned, makeOoptions(cmd));

    t.equal(opts.host, parsed_package_json.binary.production_host + '/');
    t.equal(opts.hosted_path, parsed_package_json.binary.production_host + '/');
    t.equal(opts.hosted_tarball, parsed_package_json.binary.production_host + '/' + opts.package_name);
  });
  t.end();
});

test('should use host over production_host for install and info commands (when both are preset)', (t) => {
  const makeOoptions = (cmd) => {
    return {
      argv: {
        remain: [cmd],
        cooked: [cmd],
        original: [cmd]
      }
    };
  };

  const parsed_package_json = {
    name: 'test',
    main: 'test.js',
    version: '0.1.0',
    binary: {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      production_host: 's3-production-path',
      host: 'binary-path'
    }
  };

  const cmds = ['install', 'info'];
  cmds.forEach((cmd) => {
    const cloned = JSON.parse(JSON.stringify(parsed_package_json));
    const opts = versioning.evaluate(cloned, makeOoptions(cmd));

    t.equal(opts.host, parsed_package_json.binary.host + '/');
    t.equal(opts.hosted_path, parsed_package_json.binary.host + '/');
    t.equal(opts.hosted_tarball, parsed_package_json.binary.host + '/' + opts.package_name);
  });

  cmds.forEach((cmd) => {
    // change to object format
    parsed_package_json.binary.host = { endpoint: 'binary-path' };
    const cloned = JSON.parse(JSON.stringify(parsed_package_json));
    const opts = versioning.evaluate(cloned, makeOoptions(cmd));

    t.equal(opts.host, parsed_package_json.binary.host.endpoint + '/');
    t.equal(opts.hosted_path, parsed_package_json.binary.host.endpoint + '/');
    t.equal(opts.hosted_tarball, parsed_package_json.binary.host.endpoint + '/' + opts.package_name);
  });
  t.end();
});

test('should use host by default for install and info commands (overriding alternate hosts, production_host not present)', (t) => {
  const makeOoptions = (cmd) => {
    return {
      argv: {
        remain: [cmd],
        cooked: [cmd],
        original: [cmd]
      }
    };
  };

  const parsed_package_json = {
    name: 'test',
    main: 'test.js',
    version: '0.1.0',
    binary: {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      host: 'binary-path',
      development_host: 's3-development-path',
      staging_host: 's3-staging-path'
    }
  };

  const cmds = ['install', 'info'];
  cmds.forEach((cmd) => {
    const cloned = JSON.parse(JSON.stringify(parsed_package_json));
    const opts = versioning.evaluate(cloned, makeOoptions(cmd));

    t.equal(opts.host, parsed_package_json.binary.host + '/');
    t.equal(opts.hosted_path, parsed_package_json.binary.host + '/');
    t.equal(opts.hosted_tarball, parsed_package_json.binary.host + '/' + opts.package_name);
  });
  cmds.forEach((cmd) => {
    // change to object format
    parsed_package_json.binary.host = { endpoint: 'binary-path' };
    const cloned = JSON.parse(JSON.stringify(parsed_package_json));
    const opts = versioning.evaluate(cloned, makeOoptions(cmd));

    t.equal(opts.host, parsed_package_json.binary.host.endpoint + '/');
    t.equal(opts.hosted_path, parsed_package_json.binary.host.endpoint + '/');
    t.equal(opts.hosted_tarball, parsed_package_json.binary.host.endpoint + '/' + opts.package_name);
  });
  t.end();
});

test('should use host by default for install and info commands (overriding alternate hosts, host is present)', (t) => {
  const makeOoptions = (cmd) => {
    return {
      argv: {
        remain: [cmd],
        cooked: [cmd],
        original: [cmd]
      }
    };
  };

  const parsed_package_json = {
    name: 'test',
    main: 'test.js',
    version: '0.1.0',
    binary: {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      host: 'binary-path',
      development_host: 's3-development-path',
      staging_host: 's3-staging-path',
      production_host: 's3-production-path'
    }
  };

  const cmds = ['install', 'info'];
  cmds.forEach((cmd) => {
    const cloned = JSON.parse(JSON.stringify(parsed_package_json));
    const opts = versioning.evaluate(cloned, makeOoptions(cmd));

    t.equal(opts.host, parsed_package_json.binary.host + '/');
    t.equal(opts.hosted_path, parsed_package_json.binary.host + '/');
    t.equal(opts.hosted_tarball, parsed_package_json.binary.host + '/' + opts.package_name);
  });
  cmds.forEach((cmd) => {
    // change to object format
    parsed_package_json.binary.host = { endpoint: 'binary-path' };
    const cloned = JSON.parse(JSON.stringify(parsed_package_json));
    const opts = versioning.evaluate(cloned, makeOoptions(cmd));

    t.equal(opts.host, parsed_package_json.binary.host.endpoint + '/');
    t.equal(opts.hosted_path, parsed_package_json.binary.host.endpoint + '/');
    t.equal(opts.hosted_tarball, parsed_package_json.binary.host.endpoint + '/' + opts.package_name);
  });
  t.end();
});

test('should use development_host key by default for publish and unpublish commands (when it is specified)', (t) => {
  const makeOoptions = (cmd) => {
    return {
      argv: {
        remain: [cmd],
        cooked: [cmd],
        original: [cmd]
      }
    };
  };

  const parsed_package_json = {
    name: 'test',
    main: 'test.js',
    version: '0.1.0',
    binary: {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      host: 'binary-path',
      development_host: 's3-development-path',
      staging_host: 's3-staging-path',
      production_host: 's3-production-path'
    }
  };

  const cmds = ['publish', 'unpublish'];
  cmds.forEach((cmd) => {
    const cloned = JSON.parse(JSON.stringify(parsed_package_json));
    const opts = versioning.evaluate(cloned, makeOoptions(cmd));

    t.equal(opts.host, parsed_package_json.binary.development_host + '/');
    t.equal(opts.hosted_path, parsed_package_json.binary.development_host + '/');
    t.equal(opts.hosted_tarball, parsed_package_json.binary.development_host + '/' + opts.package_name);
  });
  cmds.forEach((cmd) => {
    // change to object format
    parsed_package_json.binary.development_host = { endpoint: 's3-development-path' };
    const cloned = JSON.parse(JSON.stringify(parsed_package_json));
    const opts = versioning.evaluate(cloned, makeOoptions(cmd));

    t.equal(opts.host, parsed_package_json.binary.development_host.endpoint + '/');
    t.equal(opts.hosted_path, parsed_package_json.binary.development_host.endpoint + '/');
    t.equal(opts.hosted_tarball, parsed_package_json.binary.development_host.endpoint + '/' + opts.package_name);
  });
  t.end();
});

test('should use staging_host key by default for publish and unpublish commands (when it is specified and no development_host)', (t) => {
  const makeOoptions = (cmd) => {
    return {
      argv: {
        remain: [cmd],
        cooked: [cmd],
        original: [cmd]
      }
    };
  };

  const parsed_package_json = {
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

  const cmds = ['publish', 'unpublish'];
  cmds.forEach((cmd) => {
    const cloned = JSON.parse(JSON.stringify(parsed_package_json));
    const opts = versioning.evaluate(cloned, makeOoptions(cmd));

    t.equal(opts.host, parsed_package_json.binary.staging_host + '/');
    t.equal(opts.hosted_path, parsed_package_json.binary.staging_host + '/');
    t.equal(opts.hosted_tarball, parsed_package_json.binary.staging_host + '/' + opts.package_name);

  });
  cmds.forEach((cmd) => {
    // change to object format
    parsed_package_json.binary.staging_host = { endpoint: 's3-staging-path' };
    const cloned = JSON.parse(JSON.stringify(parsed_package_json));
    const opts = versioning.evaluate(cloned, makeOoptions(cmd));

    t.equal(opts.host, parsed_package_json.binary.staging_host.endpoint + '/');
    t.equal(opts.hosted_path, parsed_package_json.binary.staging_host.endpoint + '/');
    t.equal(opts.hosted_tarball, parsed_package_json.binary.staging_host.endpoint + '/' + opts.package_name);
  });
  t.end();
});

test('should use development_host key by default for publish and unpublish commands in a chain (when it is specified)', (t) => {
  const makeOoptions = (cmd) => {
    return {
      argv: {
        remain: ['info', cmd],
        cooked: ['info', cmd],
        original: ['info', cmd]
      }
    };
  };

  const parsed_package_json = {
    name: 'test',
    main: 'test.js',
    version: '0.1.0',
    binary: {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      host: 'binary-path',
      development_host: 's3-development-path',
      staging_host: 's3-staging-path',
      production_host: 's3-production-path'
    }
  };

  const cmds = ['publish', 'unpublish'];
  cmds.forEach((cmd) => {
    const cloned = JSON.parse(JSON.stringify(parsed_package_json));
    const opts = versioning.evaluate(cloned, makeOoptions(cmd));

    t.equal(opts.host, parsed_package_json.binary.development_host + '/');
    t.equal(opts.hosted_path, parsed_package_json.binary.development_host + '/');
    t.equal(opts.hosted_tarball, parsed_package_json.binary.development_host + '/' + opts.package_name);
  });
  cmds.forEach((cmd) => {
    // change to object format
    parsed_package_json.binary.development_host = { endpoint: 's3-development-path' };
    const cloned = JSON.parse(JSON.stringify(parsed_package_json));
    const opts = versioning.evaluate(cloned, makeOoptions(cmd));

    t.equal(opts.host, parsed_package_json.binary.development_host.endpoint + '/');
    t.equal(opts.hosted_path, parsed_package_json.binary.development_host.endpoint + '/');
    t.equal(opts.hosted_tarball, parsed_package_json.binary.development_host.endpoint + '/' + opts.package_name);
  });
  t.end();
});

test('should use host specified by the --s3_host option', (t) => {
  const makeOoptions = (cmd, host) => {
    return {
      s3_host: host,
      argv: {
        remain: [cmd],
        cooked: [cmd, '--s3_host', host],
        original: [cmd, `--s3_host=${host}`]
      }
    };
  };

  const parsed_package_json = {
    name: 'test',
    main: 'test.js',
    version: '0.1.0',
    binary: {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      // host: 'binary-path',
      development_host: 's3-development-path',
      staging_host: 's3-staging-path',
      production_host: 's3-production-path'
    }
  };

  const hosts = ['production', 'staging', 'development'];
  const cmds = ['install', 'info', 'publish', 'unpublish'];
  cmds.forEach((cmd) => {
    hosts.forEach((host) => {
      const cloned = JSON.parse(JSON.stringify(parsed_package_json));
      const opts = versioning.evaluate(cloned, makeOoptions(cmd, host));

      t.equal(opts.host, parsed_package_json.binary[`${host}_host`] + '/');
      t.equal(opts.hosted_path, parsed_package_json.binary[`${host}_host`] + '/');
      t.equal(opts.hosted_tarball, parsed_package_json.binary[`${host}_host`] + '/' + opts.package_name);
    });
  });
  cmds.forEach((cmd) => {
    hosts.forEach((host) => {
      parsed_package_json.binary = {
        module_name: 'binary-module-name',
        module_path: 'binary-module-path',
        // host: { endpoint: 'binary-path' },
        development_host: { endpoint: 's3-development-path' },
        staging_host: { endpoint: 's3-staging-path' },
        production_host: { endpoint: 's3-production-path' }
      };

      const cloned = JSON.parse(JSON.stringify(parsed_package_json));
      const opts = versioning.evaluate(cloned, makeOoptions(cmd, host));

      t.equal(opts.host, parsed_package_json.binary[`${host}_host`].endpoint + '/');
      t.equal(opts.hosted_path, parsed_package_json.binary[`${host}_host`].endpoint + '/');
      t.equal(opts.hosted_tarball, parsed_package_json.binary[`${host}_host`].endpoint + '/' + opts.package_name);
    });
  });
  t.end();
});

test('should use defaults when --s3_host option is invalid', (t) => {
  const makeOoptions = (cmd) => {
    return {
      s3_host: 'not-valid',
      argv: {
        remain: [cmd],
        cooked: [cmd, '--s3_host', 'not-valid'],
        original: [cmd, '--s3_host=not-valid']
      }
    };
  };

  const parsed_package_json = {
    name: 'test',
    main: 'test.js',
    version: '0.1.0',
    binary: {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      host: 'binary-path',
      development_host: 's3-development-path',
      staging_host: 's3-staging-path',
      production_host: 's3-production-path'
    }
  };

  const cmds = ['install', 'info', 'publish', 'unpublish'];
  cmds.forEach((cmd) => {
    const cloned = JSON.parse(JSON.stringify(parsed_package_json));
    const opts = versioning.evaluate(cloned, makeOoptions(cmd));
    const host = cmd.indexOf('publish') === -1 ? 'host' : 'development_host';

    t.equal(opts.host, parsed_package_json.binary[host] + '/');
    t.equal(opts.hosted_path, parsed_package_json.binary[host] + '/');
    t.equal(opts.hosted_tarball, parsed_package_json.binary[host] + '/' + opts.package_name);
  });
  cmds.forEach((cmd) => {
    parsed_package_json.binary = {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      host: { endpoint: 'binary-path' },
      development_host: { endpoint: 's3-development-path' },
      staging_host: { endpoint: 's3-staging-path' }
    };

    const cloned = JSON.parse(JSON.stringify(parsed_package_json));
    const opts = versioning.evaluate(cloned, makeOoptions(cmd));
    const host = cmd.indexOf('publish') === -1 ? 'host' : 'development_host';

    t.equal(opts.host, parsed_package_json.binary[host].endpoint + '/');
    t.equal(opts.hosted_path, parsed_package_json.binary[host].endpoint + '/');
    t.equal(opts.hosted_tarball, parsed_package_json.binary[host].endpoint + '/' + opts.package_name);
  });
  t.end();
});

test('should use host specified by the s3_host environment variable', (t) => {
  const makeOoptions = (cmd) => {
    return {
      argv: {
        remain: [cmd],
        cooked: [cmd],
        original: [cmd]
      }
    };
  };

  const parsed_package_json = {
    name: 'test',
    main: 'test.js',
    version: '0.1.0',
    binary: {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      // host: 'binary-path',
      development_host: 's3-development-path',
      staging_host: 's3-staging-path',
      production_host: 's3-production-path'
    }
  };

  const hosts = ['production', 'staging', 'development'];
  const cmds = ['install', 'info', 'publish', 'unpublish'];

  cmds.forEach((cmd) => {
    hosts.forEach((host) => {
      process.env.node_pre_gyp_s3_host = host;
      const cloned = JSON.parse(JSON.stringify(parsed_package_json));
      const opts = versioning.evaluate(cloned, makeOoptions(cmd));

      t.equal(opts.host, parsed_package_json.binary[`${host}_host`] + '/');
      t.equal(opts.hosted_path, parsed_package_json.binary[`${host}_host`] + '/');
      t.equal(opts.hosted_tarball, parsed_package_json.binary[`${host}_host`] + '/' + opts.package_name);
    });
  });
  cmds.forEach((cmd) => {
    hosts.forEach((host) => {
      process.env.node_pre_gyp_s3_host = host;
      parsed_package_json.binary = {
        module_name: 'binary-module-name',
        module_path: 'binary-module-path',
        // host: { endpoint: 'binary-path' },
        development_host: { endpoint: 's3-development-path' },
        staging_host: { endpoint: 's3-staging-path' },
        production_host: { endpoint: 's3-production-path' }
      };
      const cloned = JSON.parse(JSON.stringify(parsed_package_json));
      const opts = versioning.evaluate(cloned, makeOoptions(cmd, host));

      t.equal(opts.host, parsed_package_json.binary[`${host}_host`].endpoint + '/');
      t.equal(opts.hosted_path, parsed_package_json.binary[`${host}_host`].endpoint + '/');
      t.equal(opts.hosted_tarball, parsed_package_json.binary[`${host}_host`].endpoint + '/' + opts.package_name);
    });
  });
  t.end();
});

test('should use defaults when s3_host environment variable is invalid', (t) => {
  const makeOoptions = (cmd) => {
    return {
      argv: {
        remain: [cmd],
        cooked: [cmd],
        original: [cmd]
      }
    };
  };

  const parsed_package_json = {
    name: 'test',
    main: 'test.js',
    version: '0.1.0',
    binary: {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      host: 'binary-path',
      development_host: 's3-development-path',
      staging_host: 's3-staging-path',
      production_host: 's3-production-path'
    }
  };

  const cmds = ['install', 'info', 'publish', 'unpublish'];

  cmds.forEach((cmd) => {
    process.env.node_pre_gyp_s3_host = 'not-valid';
    const cloned = JSON.parse(JSON.stringify(parsed_package_json));
    const opts = versioning.evaluate(cloned, makeOoptions(cmd));
    const host = cmd.indexOf('publish') === -1 ? 'host' : 'development_host';

    t.equal(opts.host, parsed_package_json.binary[host] + '/');
    t.equal(opts.hosted_path, parsed_package_json.binary[host] + '/');
    t.equal(opts.hosted_tarball, parsed_package_json.binary[host] + '/' + opts.package_name);
  });
  cmds.forEach((cmd) => {
    parsed_package_json.binary = {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      host: { endpoint: 'binary-path' },
      development_host: { endpoint: 's3-development-path' },
      staging_host: { endpoint: 's3-staging-path' }
    };

    const cloned = JSON.parse(JSON.stringify(parsed_package_json));
    const opts = versioning.evaluate(cloned, makeOoptions(cmd));
    const host = cmd.indexOf('publish') === -1 ? 'host' : 'development_host';

    t.equal(opts.host, parsed_package_json.binary[host].endpoint + '/');
    t.equal(opts.hosted_path, parsed_package_json.binary[host].endpoint + '/');
    t.equal(opts.hosted_tarball, parsed_package_json.binary[host].endpoint + '/' + opts.package_name);
  });
  t.end();
});

test('should use defaults when s3_host environment is valid but package.json does not match (production_host is default)', (t) => {
  const makeOoptions = (cmd) => {
    return {
      argv: {
        remain: [cmd],
        cooked: [cmd],
        original: [cmd]
      }
    };
  };

  const parsed_package_json = {
    name: 'test',
    main: 'test.js',
    version: '0.1.0',
    binary: {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      // no development_host
      staging_host: 's3-staging-path',
      // production_host not host
      production_host: 's3-production-path'
    }
  };

  const cmds = ['install', 'info', 'publish', 'unpublish'];

  cmds.forEach((cmd) => {
    process.env.node_pre_gyp_s3_host = 'development';  // specify development_host
    const cloned = JSON.parse(JSON.stringify(parsed_package_json));
    const opts = versioning.evaluate(cloned, makeOoptions(cmd));
    const host = cmd.indexOf('publish') === -1 ? 'production_host' : 'staging_host'; // defaults

    t.equal(opts.host, parsed_package_json.binary[host] + '/');
    t.equal(opts.hosted_path, parsed_package_json.binary[host] + '/');
    t.equal(opts.hosted_tarball, parsed_package_json.binary[host] + '/' + opts.package_name);
  });
  cmds.forEach((cmd) => {
    process.env.node_pre_gyp_s3_host = 'development';  // specify development_host
    parsed_package_json.binary = {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      // no development_host
      staging_host: { endpoint: 's3-staging-path' },
      // production_host not host
      production_host: { endpoint: 's3-production-path' }
    };

    const cloned = JSON.parse(JSON.stringify(parsed_package_json));
    const opts = versioning.evaluate(cloned, makeOoptions(cmd));
    const host = cmd.indexOf('publish') === -1 ? 'production_host' : 'staging_host'; // defaults

    t.equal(opts.host, parsed_package_json.binary[host].endpoint + '/');
    t.equal(opts.hosted_path, parsed_package_json.binary[host].endpoint + '/');
    t.equal(opts.hosted_tarball, parsed_package_json.binary[host].endpoint + '/' + opts.package_name);
  });
  t.end();
});

test('should use defaults when s3_host environment is valid but package.json does not match (host is default)', (t) => {
  const makeOoptions = (cmd) => {
    return {
      argv: {
        remain: [cmd],
        cooked: [cmd],
        original: [cmd]
      }
    };
  };

  const parsed_package_json = {
    name: 'test',
    main: 'test.js',
    version: '0.1.0',
    binary: {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      // host not production_host
      host: 'binary-path',
      // no development_host
      staging_host: 's3-staging-path'
    }
  };

  const cmds = ['install', 'info', 'publish', 'unpublish'];

  cmds.forEach((cmd) => {
    process.env.node_pre_gyp_s3_host = 'development';  // specify development_host
    const cloned = JSON.parse(JSON.stringify(parsed_package_json));
    const opts = versioning.evaluate(cloned, makeOoptions(cmd));
    const host = cmd.indexOf('publish') === -1 ? 'host' : 'staging_host'; // defaults

    t.equal(opts.host, parsed_package_json.binary[host] + '/');
    t.equal(opts.hosted_path, parsed_package_json.binary[host] + '/');
    t.equal(opts.hosted_tarball, parsed_package_json.binary[host] + '/' + opts.package_name);
  });
  cmds.forEach((cmd) => {
    process.env.node_pre_gyp_s3_host = 'development';  // specify development_host
    parsed_package_json.binary = {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      // host not production_host
      host: { endpoint: 'binary-path' },
      // no development_host
      staging_host: { endpoint: 's3-staging-path' }
    };

    const cloned = JSON.parse(JSON.stringify(parsed_package_json));
    const opts = versioning.evaluate(cloned, makeOoptions(cmd));
    const host = cmd.indexOf('publish') === -1 ? 'host' : 'staging_host'; // defaults

    t.equal(opts.host, parsed_package_json.binary[host].endpoint + '/');
    t.equal(opts.hosted_path, parsed_package_json.binary[host].endpoint + '/');
    t.equal(opts.hosted_tarball, parsed_package_json.binary[host].endpoint + '/' + opts.package_name);
  });
  t.end();
});

test('should use host specified by environment variable overriding --s3_host option', (t) => {
  const makeOoptions = (cmd) => {
    return {
      s3_host: 'staging', // from command line
      argv: {
        remain: [cmd],
        cooked: [cmd, '--s3_host', 'staging'],
        original: [cmd, '--s3_host=staging']
      }
    };
  };

  const parsed_package_json = {
    name: 'test',
    main: 'test.js',
    version: '0.1.0',
    binary: {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      // host: 'binary-path',
      development_host: 's3-development-path',
      staging_host: 's3-staging-path',
      production_host: 's3-production-path'
    }
  };


  const cmds = ['install', 'info', 'publish', 'unpublish'];
  cmds.forEach((cmd) => {
    process.env.node_pre_gyp_s3_host = 'production';
    const cloned = JSON.parse(JSON.stringify(parsed_package_json));
    const opts = versioning.evaluate(cloned, makeOoptions(cmd));

    t.equal(opts.host, parsed_package_json.binary.production_host + '/');
    t.equal(opts.hosted_path, parsed_package_json.binary.production_host + '/');
    t.equal(opts.hosted_tarball, parsed_package_json.binary.production_host + '/' + opts.package_name);
  });

  cmds.forEach((cmd) => {
    process.env.node_pre_gyp_s3_host = 'production';
    parsed_package_json.binary = {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      // host: { endpoint: 'binary-path' },
      development_host: { endpoint: 's3-development-path' },
      staging_host: { endpoint: 's3-staging-path' },
      production_host: { endpoint: 's3-production-path' }
    };
    const cloned = JSON.parse(JSON.stringify(parsed_package_json));
    const opts = versioning.evaluate(cloned, makeOoptions(cmd));

    t.equal(opts.host, parsed_package_json.binary.production_host.endpoint + '/');
    t.equal(opts.hosted_path, parsed_package_json.binary.production_host.endpoint + '/');
    t.equal(opts.hosted_tarball, parsed_package_json.binary.production_host.endpoint + '/' + opts.package_name);
  });
  t.end();
});

/* hosted path variations */

test('should not add bucket name to hosted_path when s3ForcePathStyle is false', (t) => {
  let parsed_package_json = {
    name: 'test',
    main: 'test.js',
    version: '0.1.0',
    binary: {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      host: 'binary-path',
      bucket: 'bucket-name',
      region: 'us-west-1',
      s3ForcePathStyle: false
    }
  };

  let cloned = JSON.parse(JSON.stringify(parsed_package_json));
  let opts = versioning.evaluate(cloned, {});

  t.equal(opts.hosted_path, parsed_package_json.binary.host + '/');

  // change to object format
  parsed_package_json = {
    name: 'test',
    main: 'test.js',
    version: '0.1.0',
    binary: {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      host: {
        endpoint: 'binary-path',
        bucket: 'bucket-name',
        region: 'us-west-1',
        s3ForcePathStyle: false
      }
    }
  };

  cloned = JSON.parse(JSON.stringify(parsed_package_json));
  opts = versioning.evaluate(cloned, {});

  t.equal(opts.hosted_path, parsed_package_json.binary.host.endpoint + '/');

  t.end();
});

test('should not add bucket name to hosted_path when s3ForcePathStyle is true', (t) => {
  let parsed_package_json = {
    name: 'test',
    main: 'test.js',
    version: '0.1.0',
    binary: {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      host: 'binary-path',
      bucket: 'bucket-name',
      region: 'us-west-1',
      s3ForcePathStyle: true
    }
  };

  let cloned = JSON.parse(JSON.stringify(parsed_package_json));
  let opts = versioning.evaluate(cloned, {});

  t.equal(opts.hosted_path, parsed_package_json.binary.host + '/' + parsed_package_json.binary.bucket + '/');

  // change to object format
  parsed_package_json = {
    name: 'test',
    main: 'test.js',
    version: '0.1.0',
    binary: {
      module_name: 'binary-module-name',
      module_path: 'binary-module-path',
      host: {
        endpoint: 'binary-path',
        bucket: 'bucket-name',
        region: 'us-west-1',
        s3ForcePathStyle: true
      }
    }
  };

  cloned = JSON.parse(JSON.stringify(parsed_package_json));
  opts = versioning.evaluate(cloned, {});

  t.equal(opts.hosted_path, parsed_package_json.binary.host.endpoint + '/' + parsed_package_json.binary.host.bucket + '/');
  t.end();
});

/* other */

test('should replace "-" with "_" in mirror binary host', (t) => {
  const parsed_package_json = {
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

  process.env.npm_config_canvas_prebuilt_binary_host_mirror = 'https://registry.npmmirror.com/node-canvas-prebuilt/';
  const opts = versioning.evaluate(mock_package_json, {});
  t.equal(opts.host, 'https://registry.npmmirror.com/node-canvas-prebuilt/');
  delete process.env.npm_config_canvas_prebuilt_binary_host_mirror;
  t.end();
});

test('should normalize double slash', (t) => {
  const parsed_package_json = {
    name: 'test',
    main: 'test.js',
    version: '0.1.0',
    binary: {
      module_name: 'test',
      module_path: './lib/binding/{configuration}/{toolset}/{name}',
      remote_path: './{name}/v{version}/{configuration}/{version}/{toolset}/',
      package_name: '{module_name}-v{major}.{minor}.{patch}-{prerelease}+{build}-{toolset}-{node_abi}-{platform}-{arch}.tar.gz',
      host: 'https://some-bucket.s3.us-east-1.amazonaws.com'
    }
  };
  const cloned = JSON.parse(JSON.stringify(parsed_package_json));
  const opts = versioning.evaluate(cloned, {});

  t.equal(opts.remote_path, './test/v0.1.0/Release/0.1.0/');
  // Node v0.11.x on windows lowercases C:// when path.join is called
  // https://github.com/joyent/node/issues/7031
  t.equal(path.normalize(opts.module_path), path.join(process.cwd(), 'lib/binding/Release/test'));

  const opts_toolset = versioning.evaluate(cloned, { toolset: 'custom-toolset' });

  t.equal(opts_toolset.remote_path, './test/v0.1.0/Release/0.1.0/custom-toolset/');
  t.end();
});
