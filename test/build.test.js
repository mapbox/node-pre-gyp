"use strict";

var t = require('tap');
var run = require('./run.util.js');
var existsSync = require('fs').existsSync || require('path').existsSync;
var fs = require('fs');
var rm = require('rimraf');
var path = require('path');
var getPrevious = require('./target_version.util.js');

// The list of different sample apps that we use to test
var apps = [
    {
        'name': 'app1',
        'args': ''
    },
    {
         'name': 'app2',
         'args': '--custom_include_path=../include --debug'
    },
    {
        'name': 'app2',
        'args': '--custom_include_path=../include --toolset=cpp11'
    },
    {
        'name': 'app3',
        'args': ''
    },
    {
        'name': 'app4',
        'args': ''
    }
];

// Because the below tests only ensure that flags can be correctly passed to node-gyp is it not
// likely they will behave differently for different apps. So we save time by avoiding running these for each app.
var app = apps[0];

// make sure node-gyp options are passed by passing invalid values
// and ensuring the expected errors are returned from node-gyp
t.test(app.name + ' passes --nodedir down to node-gyp via node-pre-gyp ' + app.args, function(t) {
    run('node-pre-gyp', 'configure', '--nodedir=invalid-value', app, {}, function(err,stdout,stderr) {
        t.ok(err,'Expected command to fail');
        t.match(stderr,"common.gypi not found");
        t.end();
    });
});

// NOTE: currently fails with npm v3.x on windows (hench downgrade in appveyor.yml)
t.test(app.name + ' passes --nodedir down to node-gyp via npm' + app.args, function(t) {
    run('npm', 'install', '--build-from-source --nodedir=invalid-value', app, {}, function(err,stdout,stderr) {
        t.ok(err, 'Expected command to fail');
        t.match(stderr,"common.gypi not found");
        t.end();
    });
});

// these will not fail on windows because node-gyp falls back to the python launcher instead of erroring out:
// https://github.com/nodejs/node-gyp/blob/c84a54194781410743efe353d18ca7d20fc9d3a3/lib/configure.js#L396-L397
if (process.platform !== 'win32') {
    t.test(app.name + ' passes --python down to node-gyp via node-pre-gyp ' + app.args, function(t) {
        run('node-pre-gyp', 'configure', '--python=invalid-value', app, {}, function(err,stdout,stderr) {
            t.ok(err, 'Expected command to fail');
            t.match(stderr,"Can't find Python executable");
            t.end();
        });
    });

    t.test(app.name + ' passes --python down to node-gyp via npm ' + app.args, function(t) {
        run('node-pre-gyp', 'configure', '--build-from-source --python=invalid-value', app, {}, function(err,stdout,stderr) {
            t.ok(err, 'Expected command to fail');
            t.match(stderr,"Can't find Python executable");
            t.end();
        });
    });
}
// note: --ensure=false tells node-gyp to attempt to re-download the node headers
// even if they already exist on disk at ~/.node-gyp/{version}
t.test(app.name + ' passes --dist-url down to node-gyp via node-pre-gyp ' + app.args, function(t) {
    run('node-pre-gyp', 'configure', '--ensure=false --dist-url=invalid-value', app, {}, function(err,stdout,stderr) {
        t.ok(err, 'Expected command to fail');
        t.end();
    });
});

t.test(app.name + ' passes --dist-url down to node-gyp via npm ' + app.args, function(t) {
    run('npm', 'install', '--build-from-source --ensure=false --dist-url=invalid-value', app, {}, function(err,stdout,stderr) {
        t.ok(err, 'Expected command to fail');
        t.end();
    });
});


// Tests run for all apps

apps.forEach(function(app) {

        // clear out entire binding directory
        // to ensure no stale builds. This is needed
        // because "node-pre-gyp clean" only removes
        // the current target and not alternative builds
        t.test('cleanup of app', function(t) {
            var binding_directory = path.join(__dirname,app.name,'lib/binding');
            if (fs.existsSync(binding_directory)) {
                rm.sync(binding_directory);
            }
            t.end();
        });

        t.test(app.name + ' configures ' + app.args, function(t) {
            run('node-pre-gyp', 'configure', '--loglevel=error', app, {}, function(err,stdout,stderr) {
                t.ifError(err);
                t.end();
            });
        });

        t.test(app.name + ' configures with unparsed options ' + app.args, function(t) {
            run('node-pre-gyp', 'configure', '--loglevel=info -- -Dfoo=bar', app, {}, function(err,stdout,stderr) {
                t.ifError(err);
                t.ok(stderr.search(/(gyp info spawn args).*(-Dfoo=bar)/) > -1);
                t.end();
            });
        });

        t.test(app.name + ' builds with unparsed options ' + app.args, function(t) {
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
                            t.match(stdout,'Debug/'+app.name+'.node');
                        } else {
                            t.match(stdout,'Release/'+app.name+'.node');
                        }
                    }
                    t.end();
                });
            });
        });

        t.test(app.name + ' builds ' + app.args, function(t) {
            run('node-pre-gyp', 'rebuild', '--fallback-to-build --loglevel=error', app, {}, function(err,stdout,stderr) {
                t.ifError(err);
                if (process.platform !== 'win32') {
                    if (app.args.indexOf('--debug') > -1) {
                        t.match(stdout,'Debug/'+app.name+'.node');
                    } else {
                        t.match(stdout,'Release/'+app.name+'.node');
                    }
                }
                t.end();
            });
        });

        t.test(app.name + ' is found ' + app.args, function(t) {
            run('node-pre-gyp', 'reveal', 'module_path --silent', app, {}, function(err,stdout,stderr) {
                t.ifError(err);
                var module_path = stdout.trim();
                t.match(module_path,app.name);
                t.ok(existsSync(module_path),'is valid path to existing binary: '+ module_path);
                var module_binary = path.join(module_path,app.name+'.node');
                t.ok(existsSync(module_binary));
                t.end();
            });
        });

        t.test(app.name + ' passes tests ' + app.args, function(t) {
            run('npm','test','', app, {cwd: path.join(__dirname,app.name)}, function(err,stdout,stderr) {
                t.ifError(err);
                // we expect app2 to console.log on success
                if (app.name == 'app2') {
                    if (app.args.indexOf('--debug') > -1) {
                        t.match(stdout,'Loaded Debug build');
                    } else {
                        t.match(stdout,'Loaded Release build');
                    }
                } else {
                    // we expect some npm output
                    t.notEqual(stdout,'');
                }
                t.end();
            });
        });

        t.test(app.name + ' packages ' + app.args, function(t) {
            run('node-pre-gyp', 'package', '', app, {}, function(err,stdout,stderr) {
                t.ifError(err);
                t.end();
            });
        });

        t.test(app.name + ' package is valid ' + app.args, function(t) {
            run('node-pre-gyp', 'testpackage', '', app, {}, function(err,stdout,stderr) {
                t.ifError(err);
                t.end();
            });
        });

        var dopublish = process.env.AWS_ACCESS_KEY_ID || process.env.node_pre_gyp_accessKeyId;
        var publishSkip = dopublish ? false : 'no publish access key';
        t.test('publishing', { skip: publishSkip }, function(t) {

            t.test(app.name + ' publishes ' + app.args, function(t) {
                run('node-pre-gyp', 'unpublish publish', '', app, {}, function(err,stdout,stderr) {
                    t.ifError(err);
                    t.notEqual(stdout,'');
                    t.end();
                });
            });

            t.test(app.name + ' info shows it ' + app.args, function(t) {
                run('node-pre-gyp', 'reveal', 'package_name', app, {}, function(err,stdout,stderr) {
                    t.ifError(err);
                    var package_name = stdout.trim();
                    run('node-pre-gyp', 'info', '', app, {}, function(err,stdout,stderr) {
                        t.ifError(err);
                        t.match(stdout,package_name);
                        t.end();
                    });
                });
            });

            t.test(app.name + ' can be uninstalled ' + app.args, function(t) {
                run('node-pre-gyp', 'clean', '', app, {}, function(err,stdout,stderr) {
                    t.ifError(err);
                    t.notEqual(stdout,'');
                    t.end();
                });
            });

            t.test(app.name + ' can be installed via remote ' + app.args, function(t) {
                run('npm', 'install', '--fallback-to-build=false', app, {cwd: path.join(__dirname,app.name)}, function(err,stdout,stderr) {
                    t.ifError(err);
                    t.notEqual(stdout,'');
                    t.end();
                });
            });

            t.test(app.name + ' can be reinstalled via remote ' + app.args, function(t) {
                run('npm', 'install', '--update-binary --fallback-to-build=false', app, {cwd: path.join(__dirname,app.name)}, function(err,stdout,stderr) {
                    t.ifError(err);
                    t.notEqual(stdout,'');
                    t.end();
                });
            });

            t.test(app.name + ' via remote passes tests ' + app.args, function(t) {
                run('npm', 'install', '', app, {cwd: path.join(__dirname,app.name)}, function(err,stdout,stderr) {
                    t.ifError(err);
                    t.notEqual(stdout,'');
                    t.end();
                });
            });

            t.end();
        });

        // note: the above test will result in a non-runnable binary, so the below test must succeed otherwise all following tests will fail

        t.test(app.name + ' builds with custom --target ' + app.args, function(t) {
            run('node-pre-gyp', 'rebuild', '--loglevel=error --fallback-to-build --target='+process.versions.node, app, {}, function(err,stdout,stderr) {
                t.ifError(err);
                t.end();
            });
        });
});
