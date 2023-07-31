'use strict';

const test = require('tape');
const run = require('./run.util.js');
const existsSync = require('fs').existsSync || require('path').existsSync;
const fs = require('fs');
const rm = require('rimraf');
const path = require('path');
const napi = require('../lib/util/napi.js');
const versioning = require('../lib/util/versioning.js');

const localVer = [versioning.get_runtime_abi('node'), process.platform, process.arch].join('-');
const SOEXT = { 'darwin': 'dylib', 'linux': 'so', 'win32': 'dll' }[process.platform];

// The list of different sample apps that we use to test
// apps with . in name are variation of app with different binary hosting setting
const apps = [
  {
    'name': 'app1',
    'args': '',
    'files': {
      'base': ['binding/app1.node']
    }
  },
  {
    'name': 'app1.1',
    'args': '',
    'files': {
      'base': ['binding/app1.1.node']
    }
  },
  {
    'name': 'app1.2',
    'args': '',
    'files': {
      'base': ['binding/app1.2.node']
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
      rm.sync(binding_directory);
    }
    t.end();
  });

  test(app.name + ' build ' + app.args, (t) => {
    run('node-pre-gyp', 'rebuild', '--fallback-to-build', app, {}, (err, stdout, stderr) => {
      t.ifError(err);
      if (err) {
        console.log(stdout);
        console.log(stderr);
      }
      t.end();
    });
  });

  test(app.name + ' package ' + app.args, (t) => {
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

  if (process.env.AWS_ACCESS_KEY_ID || process.env.node_pre_gyp_accessKeyId || process.env.node_pre_gyp_mock_s3) {

    test(app.name + ' publishes ' + app.args, (t) => {
      run('node-pre-gyp', 'unpublish publish', '', app, {}, (err, stdout) => {
        t.ifError(err);
        t.notEqual(stdout, '');
        t.end();
      });
    });

    test(app.name + ' info shows it ' + app.args, (t) => {
      run('node-pre-gyp', 'reveal', 'package_name', app, {}, (err, stdout) => {
        t.ifError(err);
        let package_name = stdout.trim();
        if (package_name.indexOf('\n') !== -1) { // take just the first line
          package_name = package_name.substr(0, package_name.indexOf('\n'));
        }
        run('node-pre-gyp', 'info', '', app, {}, (err2, stdout2) => {
          t.ifError(err2);
          t.stringContains(stdout2, package_name);
          t.end();
        });
      });
    });

    test(app.name + ' can be uninstalled ' + app.args, (t) => {
      run('node-pre-gyp', 'clean', '', app, {}, (err, stdout) => {
        t.ifError(err);
        t.notEqual(stdout, '');
        t.end();
      });
    });

    test(app.name + ' can be installed via remote ' + app.args, (t) => {
      const opts = {
        cwd: path.join(__dirname, app.name),
        npg_debug: false
      };
      run('npm', 'install', '--fallback-to-build=false', app, opts, (err, stdout) => {
        t.ifError(err);
        t.notEqual(stdout, '');
        t.end();
      });
    });

    test(app.name + ' can be reinstalled via remote ' + app.args, (t) => {
      const opts = {
        cwd: path.join(__dirname, app.name),
        npg_debug: false
      };
      run('npm', 'install', '--update-binary --fallback-to-build=false', app, opts, (err, stdout) => {
        t.ifError(err);
        t.notEqual(stdout, '');
        t.end();
      });
    });

    test(app.name + ' via remote passes tests ' + app.args, (t) => {
      const opts = {
        cwd: path.join(__dirname, app.name),
        npg_debug: false
      };
      run('npm', 'install', '', app, opts, (err, stdout) => {
        t.ifError(err);
        t.notEqual(stdout, '');
        t.end();
      });
    });

    test(app.name + ' unpublishes ' + app.args, (t) => {
      run('node-pre-gyp', 'unpublish', '', app, {}, (err, stdout) => {
        t.ifError(err);
        t.notEqual(stdout, '');
        t.end();
      });
    });

  } else {
    test.skip(app.name + ' publishes ' + app.args, () => {});
  }

  // note: the above test will result in a non-runnable binary, so the below test must succeed otherwise all following tests will fail

  test(app.name + ' builds with custom --target ' + app.args, (t) => {
    run('node-pre-gyp', 'rebuild', '--loglevel=error --fallback-to-build --target=' + process.versions.node, app, {}, (err) => {
      t.ifError(err);
      t.end();
    });
  });
});
