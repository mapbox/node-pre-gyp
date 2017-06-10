"use strict";

var test = require('tape');
var cp = require('child_process');
var path = require('path');
var existsSync = require('fs').existsSync || require('path').existsSync;
var abi_crosswalk = require('../lib/util/abi_crosswalk.json');
var os = require('os');
var fs = require('fs');
var rm = require('rimraf');

var cmd_path = path.join(__dirname,'../bin/');
var sep = ':';
var propertyPrefix = '';
if (process.platform === 'win32') {
    sep = ';';
    propertyPrefix = '/p:';
}
process.env.PATH = cmd_path + sep + process.env.PATH;
process.env.NODE_PATH = path.join(__dirname,'../lib/');

function run(prog,command,args,app,opts,cb) {
    var final_cmd = prog + ' ' + command;
    if (!opts.cwd) {
        final_cmd += ' -C ' + path.join(__dirname,app.name);
    }
    // clang=1 is harmless to add, but avoids breakage on `-fno-tree-sink`
    // flag that nodejs gyp scripts add and clang does not know about
    final_cmd += ' --clang=1';
    if (process.platform === 'win32') {
        final_cmd += ' --msvs_version=2015 ';
    }
    final_cmd += ' ' + app.args;
    final_cmd += ' ' + args;
    // on unix display compile args
    if (process.platform !== 'win32') {
        final_cmd = 'V=1 ' + final_cmd;
    }

    cp.exec(final_cmd,opts,function(err,stdout,stderr) {
        if (err) {
            var error = new Error("Command failed '" + final_cmd + "'");
            error.stack = stderr;
            return cb(error,stdout,stderr);
        }
        return cb(err,stdout,stderr);
    });
}

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

function getPreviousVersion(current_version) {
    var current_parts = current_version.split('.').map(function(i) { return +i; });
    var major = current_parts[0];
    var minor = current_parts[1];
    var patch = current_parts[2];
    while (patch > 0) {
        --patch;
        var new_target = '' + major + '.' + minor + '.' + patch;
        if (new_target == current_version) {
            break;
        }
        if (abi_crosswalk[new_target]) {
            return new_target;
        }
    }
    // failed to find suitable future version that we expect is ABI compatible
    return undefined;
}

var current_version = process.version.replace('v','');
var previous_version = getPreviousVersion(current_version);
var target_abi;
var testing_crosswalk;
if (previous_version !== undefined && previous_version !== current_version) {
    target_abi = {};
    target_abi[previous_version] = abi_crosswalk[previous_version];
    testing_crosswalk = path.join(os.tmpdir(),'fake_abi_crosswalk.json');
    fs.writeFileSync(testing_crosswalk,JSON.stringify(target_abi));
}

// https://stackoverflow.com/questions/38599457/how-to-write-a-custom-assertion-for-testing-node-or-javascript-with-tape-or-che
test.Test.prototype.stringContains = function(actual, contents, message) {
  this._assert(actual.indexOf(contents) > -1, {
    message: message || 'should contain '+contents,
    operator: 'stringContains',
    actual: actual,
    expected: contents
  });
};

apps.forEach(function(app) {

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

        test(app.name + ' installs', function(t) {
            run('node-pre-gyp', 'install', '--update-binary --fallback-to-build', app, {}, function(err,stdout,stderr) {
                t.ifError(err);
                t.stringContains(stdout,'Success: ');
                t.end();
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
                t.ok(module_path.search(app.name) > -1);
                t.ok(existsSync(module_path),'is found '+ module_path);
                var module_binary = path.join(module_path,app.name+'.node');
                t.ok(existsSync(module_binary));
                t.end();
            });
        });

        test(app.name + ' passes tests ' + app.args, function(t) {
            run('npm','test','', app, {env : process.env, cwd: path.join(__dirname,app.name)}, function(err,stdout,stderr) {
                t.ifError(err);
                // we expect app2 to console.log on success
                if (app.name == 'app2') {
                    console.log(stdout);
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
                t.end();
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
                run('npm', 'install', '--fallback-to-build=false', app, {env : process.env, cwd: path.join(__dirname,app.name)}, function(err,stdout,stderr) {
                    t.ifError(err);
                    t.notEqual(stdout,'');
                    t.end();
                });
            });

            test(app.name + ' can be reinstalled via remote ' + app.args, function(t) {
                run('npm', 'install', '--update-binary --fallback-to-build=false', app, {env : process.env, cwd: path.join(__dirname,app.name)}, function(err,stdout,stderr) {
                    t.ifError(err);
                    t.notEqual(stdout,'');
                    t.end();
                });
            });

            test(app.name + ' via remote passes tests ' + app.args, function(t) {
                run('npm', 'install', '', app, {env : process.env, cwd: path.join(__dirname,app.name)}, function(err,stdout,stderr) {
                    t.ifError(err);
                    t.notEqual(stdout,'');
                    t.end();
                });
            });

        } else {
            test.skip(app.name + ' publishes ' + app.args, function() {});
        }

        test(app.name + ' builds with unparsed options ' + app.args, function(t) {
            run('node-pre-gyp', 'clean', '', app, {}, function(err,stdout,stderr) {
                t.ifError(err);
                run('node-pre-gyp', 'build', '--loglevel=info -- ' + propertyPrefix + 'FOO=bar', app, {}, function(err,stdout,stderr) {
                    t.ifError(err);
                    t.ok(stderr.search(/(gyp info spawn args).*(FOO=bar)/) > -1);
                    t.end();
                });
            });
        });

        // make sure node-gyp options are passed by passing invalid values
        // and ensuring the expected errors are returned from node-gyp
        //Python executable "foo"
        test(app.name + ' passes --nodedir down to node-gyp via node-pre-gyp ' + app.args, function(t) {
            run('node-pre-gyp', 'configure', '--nodedir=invalid-value', app, {}, function(err,stdout,stderr) {
                t.ok(err);
                t.stringContains(stderr,"common.gypi not found");
                t.end();
            });
        });

        test(app.name + ' passes --nodedir down to node-gyp via npm' + app.args, function(t) {
            run('npm', 'install', '--build-from-source --nodedir=invalid-value', app, {}, function(err,stdout,stderr) {
                t.ok(err);
                t.stringContains(stderr,"common.gypi not found");
                t.end();
            });
        });

        // TODO - for some reason these do not error on windows
        if (process.platform !== 'win32') {
            test(app.name + ' passes --python down to node-gyp via node-pre-gyp ' + app.args, function(t) {
                run('node-pre-gyp', 'configure', '--python=invalid-value', app, {}, function(err,stdout,stderr) {
                    t.ok(err);
                    t.stringContains(stderr,"Can't find Python executable");
                    t.end();
                });
            });

            test(app.name + ' passes --python down to node-gyp via npm ' + app.args, function(t) {
                run('node-pre-gyp', 'configure', '--build-from-source --python=invalid-value', app, {}, function(err,stdout,stderr) {
                    t.ok(err);
                    t.stringContains(stderr,"Can't find Python executable");
                    t.end();
                });
            });
        }
        // note: --ensure=false tells node-gyp to attempt to re-download the node headers
        // even if they already exist on disk at ~/.node-gyp/{version}
        test(app.name + ' passes --dist-url down to node-gyp via node-pre-gyp ' + app.args, function(t) {
            run('node-pre-gyp', 'configure', '--ensure=false --dist-url=invalid-value', app, {}, function(err,stdout,stderr) {
                t.ok(err);
                t.stringContains(stderr,'Invalid');
                t.end();
            });
        });

        test(app.name + ' passes --dist-url down to node-gyp via npm ' + app.args, function(t) {
            run('npm', 'install', '--build-from-source --ensure=false --dist-url=invalid-value', app, {}, function(err,stdout,stderr) {
                t.ok(err);
                t.stringContains(stderr,'Invalid');
                t.end();
            });
        });

        if (target_abi) {
            var new_env = JSON.parse(JSON.stringify(process.env));
            new_env.NODE_PRE_GYP_ABI_CROSSWALK = testing_crosswalk;
            var opts = { env : new_env };
            test(app.name + ' builds with custom --target='+previous_version+' that is greater than known version in ABI crosswalk ' + app.args, function(t) {
                run('node-pre-gyp', 'rebuild', '--loglevel=error --fallback-to-build --target='+previous_version, app, opts, function(err,stdout,stderr) {
                    t.ifError(err);
                    t.end();
                });
            });

            test(app.name + ' cleans up after installing custom --target='+previous_version+' that is greater than known in ABI crosswalk ' + app.args, function(t) {
                run('node-pre-gyp', 'clean', '--target='+previous_version, app, opts, function(err,stdout,stderr) {
                    t.ifError(err);
                    t.notEqual(stdout,'');
                    t.end();
                });
            });

        } else {
            test.skip(app.name + ' builds with custom --target that is greater than known in ABI crosswalk ' + app.args, function() {});
            test.skip(app.name + ' builds with custom --target='+previous_version+' that is greater than known in ABI crosswalk ' + app.args, function() {});
        }

        // note: the above test will result in a non-runnable binary, so the below test must succeed otherwise all following tests will fail

        test(app.name + ' builds with custom --target ' + app.args, function(t) {
            run('node-pre-gyp', 'rebuild', '--loglevel=error --fallback-to-build --target='+process.versions.node, app, {}, function(err,stdout,stderr) {
                t.ifError(err);
                t.end();
            });
        });
});
