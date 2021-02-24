'use strict';

const run = require('./run.util.js');
const test = require('tape');

const app = { 'name': 'app7', 'args': '' };
const target_arch = 'ia32';
const new_env = JSON.parse(JSON.stringify(process.env));
new_env.npm_config_arch = target_arch;

const tests = [
  {
    args: '--target_arch=' + target_arch,
    opts: {}
  },
  {
    args: '',
    opts: {
      env: new_env
    }
  }
];

/**
 * Context:
 *
 * node-pre-gyp supports two ways to cross-compile for different architectures, namely:
 * 1. Explicitly providing the --target_arch=${ARCH} argument
 * 2. Setting npm_config_arch=${ARCH} as an environment variable. This is supported by
 *    Electron: https://www.electronjs.org/docs/tutorial/using-native-node-modules#using-npm
 *
 * This test file validates whether both scenarios work, assuming a x64 host that cross-compiles to ia32.
 */

tests.forEach((testInstance) => {
  test(app.name + ' builds with custom target_arch ' + target_arch, (t) => {
    run('node-pre-gyp', 'rebuild', '--build-from-source --fallback-to-build ' + testInstance.args, app, testInstance.opts, (err, stdout) => {
      t.ifError(err);
      t.notEqual(stdout, '');
      t.end();
    });
  });

  test(app.name + ' produces a package with the correct target arch', (t) => {
    run('node-pre-gyp', 'package', testInstance.args, app, testInstance.opts, (err, stdout, stderr) => {
      t.ifError(err);
      t.notEqual(stdout, '');
      // Example: 'Binary staged at "build\stage\node-pre-gyp\app7\v0.1.0\Release\app7-v0.1.0-win32-ia32-napi-v1-node-node-v83.tar.gz"'
      // The output should contain the target_arch, in this case ia32
      const pattern = 'Binary staged at.*' + target_arch;
      t.assert(
        stderr.match(new RegExp(pattern, 'g')),
        'Generated .tar.gz file contains target_arch ' + target_arch
      );
      t.end();
    });

  });

  test(app.name, (t) => {
    run('node-pre-gyp', 'testpackage', testInstance.args, app, testInstance.opts, (err, stdout) => {
      t.ifError(err);
      t.notEqual(stdout, '');
      t.end();
    });
  });
});
