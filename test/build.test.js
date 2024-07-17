'use strict';

const test = require('tape');
const run = require('./run.util.js');
const existsSync = require('fs').existsSync || require('path').existsSync;
const fs = require('fs');
const rm = require('rimraf');

const path = require('path');
const napi = require('../lib/util/napi.js');
const versioning = require('../lib/util/versioning.js');
const tar = require('tar');

const localVer = [versioning.get_runtime_abi('node'), process.platform, process.arch].join('-');
const SOEXT = { 'darwin': 'dylib', 'linux': 'so', 'win32': 'dll' }[process.platform];

// The list of different sample apps that we use to test
const apps = [
  {
    'name': 'app1',
    'args': '',
    'files': {
      'base': ['binding/app1.node']
    }
  },
  {
    'name': 'app2',
    'args': '--custom_include_path=../include --debug',
    'files': {
      'base': ['node-pre-gyp-test-app2/app2.node']
    }
  },
  {
    'name': 'app2',
    'args': '--custom_include_path=../include --toolset=cpp11',
    'files': {
      'base': ['node-pre-gyp-test-app2/app2.node']
    }
  },
  {
    'name': 'app3',
    'args': '',
    'files': {
      'base': [[localVer, 'app3.node'].join('/')]
    }
  },
  {
    'name': 'app4',
    'args': '',
    'files': {
      'base': [[localVer, 'app4.node'].join('/'), [localVer, 'mylib.' + SOEXT].join('/')]
    }
  },
  {
    'name': 'app7',
    'args': ''
  }
];


// https://stackoverflow.com/questions/38599457/how-to-write-a-custom-assertion-for-testing-node-or-javascript-with-tape-or-che
test.Test.prototype.stringContains = function(actual, contents, message) {
  this._assert(actual.indexOf(contents) > -1, {
    message: message || 'should contain ' + contents,
    operator: 'stringContains',
    actual: actual,
    expected: contents
  });
};

// Because the below tests only ensure that flags can be correctly passed to node-gyp is it not
// likely they will behave differently for different apps. So we save time by avoiding running these for each app.
const appOne = apps[0];

// make sure node-gyp options are passed by passing invalid values
// and ensuring the expected errors are returned from node-gyp
test(appOne.name + ' passes --nodedir down to node-gyp via node-pre-gyp ' + appOne.args, (t) => {
  run('node-pre-gyp', 'configure', '--nodedir=invalid-value', appOne, {}, (err, stdout, stderr) => {
    t.ok(err, 'Expected command to fail');
    t.stringContains(stderr, 'common.gypi not found');
    t.end();
  });
});

// NOTE: currently fails with npm v3.x on windows (hence downgrade in appveyor.yml)
test(appOne.name + ' passes --nodedir down to node-gyp via npm' + appOne.args, (t) => {
  run('npm', 'install', '--build-from-source --nodedir=invalid-value', appOne, {}, (err, stdout, stderr) => {
    t.ok(err, 'Expected command to fail');
    t.stringContains(stderr, 'common.gypi not found');
    t.end();
  });
});

// note: --ensure=false tells node-gyp to attempt to re-download the node headers
// even if they already exist on disk at ~/.node-gyp/{version}
test(appOne.name + ' passes --dist-url down to node-gyp via node-pre-gyp ' + appOne.args, (t) => {
  run('node-pre-gyp', 'configure', '--ensure=false --dist-url=invalid-value', appOne, {}, (err) => {
    t.ok(err, 'Expected command to fail');
    t.end();
  });
});

test(appOne.name + ' passes --dist-url down to node-gyp via npm ' + appOne.args, (t) => {
  run('npm', 'install', '--build-from-source --ensure=false --dist-url=invalid-value', appOne, {}, (err) => {
    t.ok(err, 'Expected command to fail');
    t.end();
  });
});


// Tests run for all apps

apps.forEach((app) => {


  if (app.name === 'app7' && !napi.get_napi_version()) return;

  // clear out entire binding directory
  // to ensure no stale builds. This is needed
  // because "node-pre-gyp clean" only removes
  // the current target and not alternative builds
  test('cleanup of app', (t) => {
    const binding_directory = path.join(__dirname, app.name, 'lib/binding');
    if (fs.existsSync(binding_directory)) {
      rm.rimrafSync(binding_directory);
    }
    t.end();
  });

  test(app.name + ' configures ' + app.args, (t) => {
    run('node-pre-gyp', 'configure', '--loglevel=error', app, {}, (err) => {
      t.ifError(err);
      t.end();
    });
  });

  test(app.name + ' configures with unparsed options ' + app.args, (t) => {
    run('node-pre-gyp', 'configure', '--loglevel=info -- -Dfoo=bar', app, {}, (err, stdout, stderr) => {
      t.ifError(err);
      const clean = stdout.replaceAll('\n', '');
      t.equal(clean, '');
      t.ok(stderr.search(/(gyp info spawn args).*(-Dfoo=bar)/) > -1);
      t.end();
    });
  });

  if (process.platform !== 'win32') {
    test(app.name + ' builds with unparsed options ' + app.args, (t) => {
      // clean and build as separate steps here because configure only works with -Dfoo=bar
      // and build only works with FOO=bar
      run('node-pre-gyp', 'clean', '', app, {}, (err) => {
        t.ifError(err);
        const propertyPrefix = (process.platform === 'win32') ? '/p:' : '';
        run('node-pre-gyp', 'build', '--loglevel=info -- ' + propertyPrefix + 'FOO=bar', app, {}, (err2, stdout, stderr) => {
          t.ifError(err2);
          t.ok(stderr.search(/(gyp info spawn args).*(FOO=bar)/) > -1);
          if (process.platform !== 'win32') {
            if (app.args.indexOf('--debug') > -1) {
              t.stringContains(stdout, 'Debug/' + app.name + '.node');
            } else {
              t.stringContains(stdout, 'Release/' + app.name + '.node');
            }
          }
          t.end();
        });
      });
    });
  } else {
    // Skipping since this support broke upstream in node-gyp: https://github.com/nodejs/node-gyp/pull/1616
    test.skip(app.name + ' builds with unparsed options ' + app.args, () => {});
  }

  test(app.name + ' builds ' + app.args, (t) => {
    run('node-pre-gyp', 'rebuild', '--fallback-to-build', app, {}, (err, stdout, stderr) => {
      t.ifError(err);
      if (err) {
        console.log(stdout);
        console.log(stderr);
      }
      if (process.platform !== 'win32') {
        if (app.args.indexOf('--debug') > -1) {
          t.stringContains(stdout, 'Debug/' + app.name + '.node');
        } else {
          t.stringContains(stdout, 'Release/' + app.name + '.node');
        }
      }
      t.end();
    });
  });

  test(app.name + ' is found ' + app.args, (t) => {
    run('node-pre-gyp', 'reveal', 'module_path --silent', app, {}, (err, stdout) => {
      t.ifError(err);
      let module_path = stdout.trim();
      if (module_path.indexOf('\n') !== -1) { // take just the first line
        module_path = module_path.substr(0, module_path.indexOf('\n'));
      }
      t.stringContains(module_path, app.name);
      t.ok(existsSync(module_path), 'is valid path to existing binary: ' + module_path);
      const module_binary = path.join(module_path, app.name + '.node');
      t.ok(existsSync(module_binary));
      t.end();
    });
  });

  test(app.name + ' passes tests ' + app.args, (t) => {
    run('npm', 'test', '', app, { cwd: path.join(__dirname, app.name) }, (err, stdout) => {
      t.ifError(err);
      // we expect app2 to console.log on success
      if (app.name === 'app2') {
        if (app.args.indexOf('--debug') > -1) {
          t.stringContains(stdout, 'Loaded Debug build');
        } else {
          t.stringContains(stdout, 'Loaded Release build');
        }
      } else {
        // we expect some npm output
        t.notEqual(stdout, '');
      }
      t.end();
    });
  });



  test(app.name + ' packages ' + app.args, (t) => {
    run('node-pre-gyp', 'package', '', app, {}, (err) => {
      t.ifError(err);
      // Make sure a tarball was created
      run('node-pre-gyp', 'reveal', 'staged_tarball --silent', app, {}, (err2, stdout) => {
        t.ifError(err2);
        let staged_tarball = stdout.trim();
        if (staged_tarball.indexOf('\n') !== -1) { // take just the first line
          staged_tarball = staged_tarball.substr(0, staged_tarball.indexOf('\n'));
        }
        const tarball_path = path.join(__dirname, app.name, staged_tarball);
        t.ok(existsSync(tarball_path), 'staged tarball is a valid file');
        if (!app.files) {
          return t.end();
        }
        // Make sure the package contains what we expect
        const entries = [];
        tar.t({
          file: tarball_path,
          sync: true,
          onentry: function(entry) {
            entries.push(entry.path);
          }
        });
        let files = app.files.base;
        const nodever = versioning.get_runtime_abi('node');
        // Look for a more specific choice
        if (Object.hasOwnProperty.call(app.files, process.platform)) {
          const appPlatList = app.files[process.platform];
          if (Object.hasOwnProperty.call(appPlatList, nodever)) {
            files = appPlatList[nodever];
          } else if (Object.hasOwnProperty.call(appPlatList, 'base')) {
            files = appPlatList.base;
          } else {
            files = appPlatList;
          }
        }
        // windows is too variable to keep this test up to date across node versions
        if (process.platform !== 'win32') {
          t.same(entries.sort(), files.sort(), 'staged tarball contains the right files');
        }
        t.end();
      });
    });
  });

  test(app.name + ' package is valid ' + app.args, (t) => {
    run('node-pre-gyp', 'testpackage', '', app, {}, (err) => {
      t.ifError(err);
      t.end();
    });
  });

  // note: the above test will result in a non-runnable binary, so the below test must succeed otherwise all following tests will fail

  test(app.name + ' builds with custom --target ' + app.args, (t) => {
    run('node-pre-gyp', 'rebuild', '--loglevel=error --fallback-to-build --target=' + process.versions.node, app, {}, (err) => {
      t.ifError(err);
      t.end();
    });
  });
});
