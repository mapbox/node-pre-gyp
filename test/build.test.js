"use strict";

var test = require('tape');
var run = require('./run.util.js');
var existsSync = require('fs').existsSync || require('path').existsSync;
var fs = require('fs');
var rm = require('rimraf');
var path = require('path');
var getPrevious = require('./target_version.util.js');
var napi = require ('../lib/util/napi.js');
var versioning = require('../lib/util/versioning.js');
var tar = require('tar');

var localVer = [versioning.get_runtime_abi('node'), process.platform, process.arch].join('-');
var SOEXT = {'darwin': 'dylib', 'linux': 'so', 'win32': 'dll'}[process.platform];

// The list of different sample apps that we use to test
var apps = [
    {
        'name': 'app1',
        'args': '',
        'files': {
            'base': ['binding/app1.node'],
            'win32': {
                'base': [
                    'binding/app1.exp',
                    'binding/app1.lib',
                    'binding/app1.map',
                    'binding/app1.node'
                ],
                'node-v59': [
                    'binding/app1.exp',
                    'binding/app1.iobj',
                    'binding/app1.ipdb',
                    'binding/app1.lib',
                    'binding/app1.map',
                    'binding/app1.node'
                ],
                'node-v64': [
                    'binding/app1.exp',
                    'binding/app1.iobj',
                    'binding/app1.ipdb',
                    'binding/app1.lib',
                    'binding/app1.map',
                    'binding/app1.node'
                ]
            }
        }
    },
    {
        'name': 'app2',
        'args': '--custom_include_path=../include --debug',
        'files': {
            'base': ['node-pre-gyp-test-app2/app2.node'],
            'win32': [
                'node-pre-gyp-test-app2/app2.exp',
                'node-pre-gyp-test-app2/app2.ilk',
                'node-pre-gyp-test-app2/app2.lib',
                'node-pre-gyp-test-app2/app2.map',
                'node-pre-gyp-test-app2/app2.node'
            ]
        }
    },
    {
        'name': 'app2',
        'args': '--custom_include_path=../include --toolset=cpp11',
        'files': {
            'base': ['node-pre-gyp-test-app2/app2.node'],
            'win32': {
                'base': [
                    'node-pre-gyp-test-app2/app2.exp',
                    'node-pre-gyp-test-app2/app2.lib',
                    'node-pre-gyp-test-app2/app2.map',
                    'node-pre-gyp-test-app2/app2.node'
                ],
                'node-v59': [
                    'node-pre-gyp-test-app2/app2.exp',
                    'node-pre-gyp-test-app2/app2.iobj',
                    'node-pre-gyp-test-app2/app2.ipdb',
                    'node-pre-gyp-test-app2/app2.lib',
                    'node-pre-gyp-test-app2/app2.map',
                    'node-pre-gyp-test-app2/app2.node'
                ],
                'node-v64': [
                    'node-pre-gyp-test-app2/app2.exp',
                    'node-pre-gyp-test-app2/app2.iobj',
                    'node-pre-gyp-test-app2/app2.ipdb',
                    'node-pre-gyp-test-app2/app2.lib',
                    'node-pre-gyp-test-app2/app2.map',
                    'node-pre-gyp-test-app2/app2.node'
                ]
            }
        }
    },
    {
        'name': 'app3',
        'args': '',
        'files': {
            'base': [[localVer, 'app3.node'].join('/')],
            'win32': {
                'base': [
                    [localVer, 'app3.exp'].join('/'),
                    [localVer, 'app3.lib'].join('/'),
                    [localVer, 'app3.map'].join('/'),
                    [localVer, 'app3.node'].join('/')
                ],
                'node-v59': [
                    [localVer, 'app3.exp'].join('/'),
                    [localVer, 'app3.iobj'].join('/'),
                    [localVer, 'app3.ipdb'].join('/'),
                    [localVer, 'app3.lib'].join('/'),
                    [localVer, 'app3.map'].join('/'),
                    [localVer, 'app3.node'].join('/'),
                ],
                'node-v64': [
                    [localVer, 'app3.exp'].join('/'),
                    [localVer, 'app3.iobj'].join('/'),
                    [localVer, 'app3.ipdb'].join('/'),
                    [localVer, 'app3.lib'].join('/'),
                    [localVer, 'app3.map'].join('/'),
                    [localVer, 'app3.node'].join('/'),
                ]
            }
        }
    },
    {
        'name': 'app4',
        'args': '',
        'files': {
            'base': [[localVer, 'app4.node'].join('/'), [localVer, 'lib.target', 'mylib.' + SOEXT].join('/')],
            'win32': [[localVer, 'app4.node'].join('/'), [localVer, 'mylib.' + SOEXT].join('/')]
        }
    },
    {
        'name': 'app7',
        'args': ''
    },
    {
        'name': 'app8',
        'args': '',
        'files': {
            'base': ['lib/app8.node'],
            'win32': {
                'base': [
                    'lib/app8.exp',
                    'lib/app8.lib',
                    'lib/app8.map',
                    'lib/app8.node'
                ],
                'node-v59': [
                    'lib/app8.exp',
                    'lib/app8.iobj',
                    'lib/app8.ipdb',
                    'lib/app8.lib',
                    'lib/app8.map',
                    'lib/app8.node'
                ],
                'node-v64': [
                    'lib/app8.exp',
                    'lib/app8.iobj',
                    'lib/app8.ipdb',
                    'lib/app8.lib',
                    'lib/app8.map',
                    'lib/app8.node'
                ]
            }
        }
    }
];


// https://stackoverflow.com/questions/38599457/how-to-write-a-custom-assertion-for-testing-node-or-javascript-with-tape-or-che
test.Test.prototype.stringContains = function(actual, contents, message) {
  this._assert(actual.indexOf(contents) > -1, {
    message: message || 'should contain '+contents,
    operator: 'stringContains',
    actual: actual,
    expected: contents
  });
};

// Because the below tests only ensure that flags can be correctly passed to node-gyp is it not
// likely they will behave differently for different apps. So we save time by avoiding running these for each app.
var app = apps[0];

// make sure node-gyp options are passed by passing invalid values
// and ensuring the expected errors are returned from node-gyp
test(app.name + ' passes --nodedir down to node-gyp via node-pre-gyp ' + app.args, function(t) {
    run('node-pre-gyp', 'configure', '--nodedir=invalid-value', app, {}, function(err,stdout,stderr) {
        t.ok(err,'Expected command to fail');
        t.stringContains(stderr,"common.gypi not found");
        t.end();
    });
});

// NOTE: currently fails with npm v3.x on windows (hence downgrade in appveyor.yml)
test(app.name + ' passes --nodedir down to node-gyp via npm' + app.args, function(t) {
    run('npm', 'install', '--build-from-source --nodedir=invalid-value', app, {}, function(err,stdout,stderr) {
        t.ok(err, 'Expected command to fail');
        t.stringContains(stderr,"common.gypi not found");
        t.end();
    });
});

// these will not fail on windows because node-gyp falls back to the python launcher instead of erroring out:
// https://github.com/nodejs/node-gyp/blob/c84a54194781410743efe353d18ca7d20fc9d3a3/lib/configure.js#L396-L397
if (process.platform !== 'win32') {
    test(app.name + ' passes --python down to node-gyp via node-pre-gyp ' + app.args, function(t) {
        run('node-pre-gyp', 'configure', '--python=invalid-value', app, {}, function(err,stdout,stderr) {
            t.ok(err, 'Expected command to fail');
            t.stringContains(stderr,"Can't find Python executable");
            t.end();
        });
    });

    test(app.name + ' passes --python down to node-gyp via npm ' + app.args, function(t) {
        run('node-pre-gyp', 'configure', '--build-from-source --python=invalid-value', app, {}, function(err,stdout,stderr) {
            t.ok(err, 'Expected command to fail');
            t.stringContains(stderr,"Can't find Python executable");
            t.end();
        });
    });
}
// note: --ensure=false tells node-gyp to attempt to re-download the node headers
// even if they already exist on disk at ~/.node-gyp/{version}
test(app.name + ' passes --dist-url down to node-gyp via node-pre-gyp ' + app.args, function(t) {
    run('node-pre-gyp', 'configure', '--ensure=false --dist-url=invalid-value', app, {}, function(err,stdout,stderr) {
        t.ok(err, 'Expected command to fail');
        t.end();
    });
});

test(app.name + ' passes --dist-url down to node-gyp via npm ' + app.args, function(t) {
    run('npm', 'install', '--build-from-source --ensure=false --dist-url=invalid-value', app, {}, function(err,stdout,stderr) {
        t.ok(err, 'Expected command to fail');
        t.end();
    });
});


// Tests run for all apps

apps.forEach(function(app) {

        if (app.name === 'app7' && !napi.get_napi_version()) return;

        // clear out entire binding directory
        // to ensure no stale builds. This is needed
        // because "node-pre-gyp clean" only removes
        // the current target and not alternative builds
        test('cleanup of app', function(t) {
            var binding_directory = path.join(__dirname,app.name,'lib/binding');
            if (fs.existsSync(binding_directory)) {
                rm.sync(binding_directory);
            }
            t.end();
        });

        test(app.name + ' configures ' + app.args, function(t) {
            run('node-pre-gyp', 'configure', '--loglevel=error', app, {}, function(err,stdout,stderr) {
                t.ifError(err);
                t.end();
            });
        });

        test(app.name + ' configures with unparsed options ' + app.args, function(t) {
            run('node-pre-gyp', 'configure', '--loglevel=info -- -Dfoo=bar', app, {}, function(err,stdout,stderr) {
                t.ifError(err);
                t.ok(stderr.search(/(gyp info spawn args).*(-Dfoo=bar)/) > -1);
                t.end();
            });
        });

        test(app.name + ' builds with unparsed options ' + app.args, function(t) {
            // clean and build as separate steps here because configure only works with -Dfoo=bar
            // and build only works with FOO=bar
            run('node-pre-gyp', 'clean', '', app, {}, function(err) {
                t.ifError(err);
                var propertyPrefix = (process.platform === 'win32') ? '/p:' : '';
                run('node-pre-gyp', 'build', '--loglevel=info -- ' + propertyPrefix + 'FOO=bar', app, {}, function(err,stdout,stderr) {
                    t.ifError(err);
                    t.ok(stderr.search(/(gyp info spawn args).*(FOO=bar)/) > -1);
                    if (process.platform !== 'win32') {
                        if (app.args.indexOf('--debug') > -1) {
                            t.stringContains(stdout,'Debug/'+app.name+'.node');
                        } else {
                            t.stringContains(stdout,'Release/'+app.name+'.node');
                        }
                    }
                    t.end();
                });
            });
        });

        test(app.name + ' builds ' + app.args, function(t) {
            run('node-pre-gyp', 'rebuild', '--fallback-to-build --loglevel=error', app, {}, function(err,stdout,stderr) {
                t.ifError(err);
                if (process.platform !== 'win32') {
                    if (app.args.indexOf('--debug') > -1) {
                        t.stringContains(stdout,'Debug/'+app.name+'.node');
                    } else {
                        t.stringContains(stdout,'Release/'+app.name+'.node');
                    }
                }
                t.end();
            });
        });

        test(app.name + ' is found ' + app.args, function(t) {
            run('node-pre-gyp', 'reveal', 'module_path --silent', app, {}, function(err,stdout,stderr) {
                t.ifError(err);
                var module_path = stdout.trim();
                if (module_path.indexOf('\n') !== -1) { // take just the first line
                    module_path = module_path.substr(0,module_path.indexOf('\n'));
                }
                t.stringContains(module_path,app.name);
                t.ok(existsSync(module_path),'is valid path to existing binary: '+ module_path);
                var module_binary = path.join(module_path,app.name+'.node');
                t.ok(existsSync(module_binary));
                t.end();
            });
        });

        test(app.name + ' passes tests ' + app.args, function(t) {
            run('npm','test','', app, {cwd: path.join(__dirname,app.name)}, function(err,stdout,stderr) {
                t.ifError(err);
                // we expect app2 to console.log on success
                if (app.name == 'app2') {
                    if (app.args.indexOf('--debug') > -1) {
                        t.stringContains(stdout,'Loaded Debug build');
                    } else {
                        t.stringContains(stdout,'Loaded Release build');
                    }
                } else {
                    // we expect some npm output
                    t.notEqual(stdout,'');
                }
                t.end();
            });
        });

        test(app.name + ' packages ' + app.args, function(t) {
            run('node-pre-gyp', 'package', '', app, {}, function(err,stdout,stderr) {
                t.ifError(err);
                // Make sure a tarball was created
                run('node-pre-gyp', 'reveal', 'staged_tarball --silent', app, {}, function(err,stdout,stderr) {
                    t.ifError(err);
                    var staged_tarball = stdout.trim();
                    if (staged_tarball.indexOf('\n') !== -1) { // take just the first line
                        staged_tarball = staged_tarball.substr(0,staged_tarball.indexOf('\n'));
                    }
                    var tarball_path = path.join(__dirname, app.name, staged_tarball);
                    t.ok(existsSync(tarball_path),'staged tarball is a valid file');
                    if (!app.files) {
                        return t.end();
                    }
                    // Make sure the package contains what we expect
                    var entries = [];
                    tar.t({
                        file: tarball_path,
                        sync: true,
                        onentry: function (entry) {
                            entries.push(entry.path);
                        }
                    });
                    var files = app.files.base;
                    var nodever = versioning.get_runtime_abi('node');
                    // Look for a more specific choice
                    if (app.files.hasOwnProperty(process.platform)) {
                        if (app.files[process.platform].hasOwnProperty(nodever)) {
                            files = app.files[process.platform][nodever];
                        } else if (app.files[process.platform].hasOwnProperty('base')) {
                            files = app.files[process.platform].base;
                        } else {
                            files = app.files[process.platform];
                        }
                    }
                    t.same(entries.sort(), files.sort(), 'staged tarball contains the right files');
                    t.end();
                });
            });
        });

        test(app.name + ' package is valid ' + app.args, function(t) {
            run('node-pre-gyp', 'testpackage', '', app, {}, function(err,stdout,stderr) {
                t.ifError(err);
                t.end();
            });
        });

        if (process.env.AWS_ACCESS_KEY_ID || process.env.node_pre_gyp_accessKeyId) {

            test(app.name + ' publishes ' + app.args, function(t) {
                run('node-pre-gyp', 'unpublish publish', '', app, {}, function(err,stdout,stderr) {
                    t.ifError(err);
                    t.notEqual(stdout,'');
                    t.end();
                });
            });

            test(app.name + ' info shows it ' + app.args, function(t) {
                run('node-pre-gyp', 'reveal', 'package_name', app, {}, function(err,stdout,stderr) {
                    t.ifError(err);
                    var package_name = stdout.trim();
                    if (package_name.indexOf('\n') !== -1) { // take just the first line
                        package_name = package_name.substr(0,package_name.indexOf('\n'));
                    }
                    run('node-pre-gyp', 'info', '', app, {}, function(err,stdout,stderr) {
                        t.ifError(err);
                        t.stringContains(stdout,package_name);
                        t.end();
                    });
                });
            });

            test(app.name + ' can be uninstalled ' + app.args, function(t) {
                run('node-pre-gyp', 'clean', '', app, {}, function(err,stdout,stderr) {
                    t.ifError(err);
                    t.notEqual(stdout,'');
                    t.end();
                });
            });

            test(app.name + ' can be installed via remote ' + app.args, function(t) {
                run('npm', 'install', '--fallback-to-build=false', app, {cwd: path.join(__dirname,app.name)}, function(err,stdout,stderr) {
                    t.ifError(err);
                    t.notEqual(stdout,'');
                    t.end();
                });
            });

            test(app.name + ' can be reinstalled via remote ' + app.args, function(t) {
                run('npm', 'install', '--update-binary --fallback-to-build=false', app, {cwd: path.join(__dirname,app.name)}, function(err,stdout,stderr) {
                    t.ifError(err);
                    t.notEqual(stdout,'');
                    t.end();
                });
            });

            test(app.name + ' via remote passes tests ' + app.args, function(t) {
                run('npm', 'install', '', app, {cwd: path.join(__dirname,app.name)}, function(err,stdout,stderr) {
                    t.ifError(err);
                    t.notEqual(stdout,'');
                    t.end();
                });
            });

        } else {
            test.skip(app.name + ' publishes ' + app.args, function() {});
        }

        // note: the above test will result in a non-runnable binary, so the below test must succeed otherwise all following tests will fail

        test(app.name + ' builds with custom --target ' + app.args, function(t) {
            run('node-pre-gyp', 'rebuild', '--loglevel=error --fallback-to-build --target='+process.versions.node, app, {}, function(err,stdout,stderr) {
                t.ifError(err);
                t.end();
            });
        });
});
