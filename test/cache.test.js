"use strict";

var test = require('tape');
var path = require('path');
var fs = require('fs');
var cp = require('child_process');

var binPath = path.join(__dirname,'..','bin','node-pre-gyp');
var install_cmd = binPath + ' install --update-binary --fallback-to-build=false';

var cache_dir = path.join(__dirname, 'cache');
var test_dir = path.join(__dirname, 'app1');

function run(cmd,opts,callback) {
    if(typeof opts === 'function') {
        callback = opts;
        opts = null;
    }
    var test_env = Object.assign({}, process.env, { NODE_PRE_GYP_CACHE: cache_dir }, opts);
    cp.exec(cmd, { cwd: test_dir, env: test_env }, callback);
}

function install(cmd,opts,callback) {
    if(typeof cmd === 'function') {
        callback = cmd;
        cmd = install_cmd;
    }
    run(cmd, opts, callback);
}

function on_error(err,stdout,stderr) {
    var msg = err.message;
    msg += '\nstdout: ' + stdout;
    msg += '\nstderr: ' + stderr;
    throw new Error(msg);
}

(/^v0.10/.test(process.version) ? test.skip : test)('caching', function(suite) {
    suite.test('setup', function (t) {
        // cleanup
        fs.mkdir(cache_dir, function(err) {
            if(err && err.code !== 'EEXIST') throw err;
            t.end();
        });
    });

    function beforeEach(t) {
        var files = fs.readdirSync(cache_dir);
        files.forEach(function(file) {
            fs.unlinkSync(path.join(cache_dir,file));
        });
    };

    suite.test('populates the cache when file is missing', function(t) {
        beforeEach();
        install(function(err,stdout,stderr) {
            if(err) return on_error(err,stdout,stderr);
            fs.readdir(cache_dir, function(err, files) {
                if(err) throw err;
                t.equal(files.length, 1);
                t.end();
            });
        });
    });

    suite.test('uses the cache', function(t) {
        beforeEach();
        install(function(err,stdout,stderr) {
            if(err) return on_error(err,stdout,stderr);
            fs.readdir(cache_dir, function(err, files) {
                if(err) throw err;
                var mtime = fs.statSync(path.join(cache_dir,files[0])).mtime;
                install(install_cmd + ' --loglevel=verbose', function(err,stdout,stderr) {
                    t.ok(stderr.indexOf('from cache') > -1);
                    t.equal(stderr.indexOf('http'), -1);
                    t.equal(fs.statSync(path.join(cache_dir,files[0])).mtime.getTime(), mtime.getTime(), 'cache value was not updated');
                    t.end();
                });
            });
        });
    });

    suite.test('ignores the cache if it is invalid', function(t) {
        beforeEach();
        install(function(err,stdout,stderr) {
            if(err) return on_error(err,stdout,stderr);
            fs.readdir(cache_dir, function(err, files) {
                if(err) throw err;
                files.forEach(function(file) { fs.writeFileSync(path.join(cache_dir,file), 'NOT A TAR'); });
                install(function(err,stdout,stderr) { // cache now contains bad files
                    if(err) return on_error(err,stdout,stderr);
                    fs.readdir(cache_dir, function(err, files) {
                        files.forEach(function(file) {
                            t.notEqual(fs.readFileSync(path.join(cache_dir,file),'utf8'),'NOT A TAR','bad cache is replaced');
                        }); // bad cache value replaced with a good one
                        t.end();
                    });
                });
            });
        });
    });

    suite.test('ignores the cache if told to', function(t) {
        beforeEach();
        install(function(err,stdout,stderr) {
            if(err) return on_error(err,stdout,stderr);
            fs.readdir(cache_dir, function(err, files) { // populate cache
                if(err) throw err;
                var mtime = fs.statSync(path.join(cache_dir,files[0])).mtime;
                install(install_cmd + ' --ignore-node-pre-gyp-cache', function(err,stdout,stderr) {
                    if(err) return on_error(err,stdout,stderr);
                    t.equal(stderr.indexOf('from cache'), -1);
                    t.ok(fs.statSync(path.join(cache_dir,files[0])).mtime.getTime() > mtime.getTime(), 'cache value was not used, but was instead updated');
                    t.end();
                });
            });
        });
    });

    suite.test('ignores the cache and doesn\'t update it if told to', function(t) {
        beforeEach();
        install(function(err,stdout,stderr) {
            if(err) return on_error(err,stdout,stderr);
            fs.readdir(cache_dir, function(err, files) { // populate cache
                if(err) throw err;
                var mtime = fs.statSync(path.join(cache_dir,files[0])).mtime;
                install(install_cmd + ' --ignore-node-pre-gyp-cache --skip-node-pre-gyp-cache', function(err,stdout,stderr) {
                    if(err) return on_error(err,stdout,stderr);
                    t.equal(stderr.indexOf('from cache'), -1);
                    t.equal(fs.statSync(path.join(cache_dir,files[0])).mtime.getTime(), mtime.getTime(), 'cache value was not updated');
                    t.end();
                });
            });
        });
    });

    suite.test('ignores the cache and doesn\'t update it if told to via npm', function(t) {
        beforeEach();
        install(function(err,stdout,stderr) {
            if(err) return on_error(err,stdout,stderr);
            fs.readdir(cache_dir, function(err, files) { // populate cache
                if(err) throw err;
                var mtime = fs.statSync(path.join(cache_dir,files[0])).mtime;
                install(install_cmd, { npm_config_node_pre_gyp_cache: 'false' }, function(err,stdout,stderr) {
                    if(err) return on_error(err,stdout,stderr);
                    t.equal(stderr.indexOf('from cache'), -1);
                    t.equal(fs.statSync(path.join(cache_dir,files[0])).mtime.getTime(), mtime.getTime(), 'cache value was not updated');
                    t.end();
                });
            });
        });
    });

    suite.test('proceeds even when the cache dir can\'t be accessed/created', function(t) {
        beforeEach();
        install(install_cmd + ' --loglevel=verbose', { NODE_PRE_GYP_CACHE: path.join(cache_dir, 'x', 'x') }, function(err,stdout,stderr) {
            if(err) return on_error(err,stdout,stderr);
            t.ok(stderr.indexOf('http') > -1, 'fetched binding');
            t.end();
        });
    });

    suite.test('populates the cache with a local build', function(t) {
        beforeEach();
        run(binPath + ' rebuild --fallback-to-build --loglevel=error', function(err,stdout,stderr) {
            if(err) return on_error(err,stdout,stderr);
            fs.readdir(cache_dir, function(err, files) {
                if(err) throw err;
                t.equal(files.length, 1);
                t.end();
            });
        });
    });

    suite.test('doesn\'t write to the cache when told not to', function(t) {
        beforeEach();
        run(binPath + ' rebuild --fallback-to-build --loglevel=error --skip-node-pre-gyp-cache', function(err,stdout,stderr) {
            if(err) return on_error(err,stdout,stderr);
            fs.readdir(cache_dir, function(err, files) {
                if(err) throw err;
                t.equal(files.length, 0);
                t.end();
            });
        });
    });

    suite.test('doesn\'t write to the cache when told not to by npm', function(t) {
        beforeEach();
        run(binPath + ' rebuild --fallback-to-build --loglevel=error', { npm_config_node_pre_gyp_cache: 'false' }, function(err,stdout,stderr) {
            if(err) return on_error(err,stdout,stderr);
            fs.readdir(cache_dir, function(err, files) {
                if(err) throw err;
                t.equal(files.length, 0);
                t.end();
            });
        });
    });

    suite.test('reuses a cached local build', function(t) {
        beforeEach();
        run(binPath + ' rebuild --fallback-to-build --loglevel=error', function(err,stdout,stderr) {
            if(err) return on_error(err,stdout,stderr);
            fs.readdir(cache_dir, function(err, files) {
                if(err) throw err;
                var mtime = fs.statSync(path.join(cache_dir,files[0])).mtime;
                install(install_cmd + ' --loglevel=verbose', function(err,stdout,stderr) {
                    t.ok(stderr.indexOf('from cache') > -1);
                    t.equal(stderr.indexOf('http'), -1);
                    t.equal(fs.statSync(path.join(cache_dir,files[0])).mtime.getTime(), mtime.getTime(), 'cache value was not updated');
                    t.end();
                });
            });
        });
    });

    suite.test('clean', function(cleanSuite) {
        cleanSuite.test('can clean the cache', function(t) {
            beforeEach();
            install(function(err,stdout,stderr) {
                if(err) return on_error(err,stdout,stderr);
                fs.readdir(cache_dir, function(err, files) {
                    if(err) throw err;
                    t.equal(files.length, 1);
                    run(binPath + ' cache-clean', function(err,stdout,stderr) {
                        if(err) return on_error(err,stdout,stderr);
                        fs.readdir(cache_dir, function(err, files) {
                            if(err) throw err;
                            t.equal(files.length, 0);
                            t.end();
                        });
                    });
                });
            });
        });

        cleanSuite.test('doesn\'t remove non-tarballs from the cache', function(t) {
            beforeEach();
            install(function(err,stdout,stderr) {
                if(err) return on_error(err,stdout,stderr);
                fs.writeFileSync(path.join(cache_dir, 'blah'), 'something');
                if(err) throw err;
                run(binPath + ' cache-clean', function(err,stdout,stderr) {
                    if(err) return on_error(err,stdout,stderr);
                    fs.readdir(cache_dir, function(err, files) {
                        if(err) throw err;
                        t.equal(files.length, 1);
                        t.end();
                    });
                });
            });
        });

        cleanSuite.test('can be told to remove everything from the cache', function(t) {
            beforeEach();
            install(function(err,stdout,stderr) {
                if(err) return on_error(err,stdout,stderr);
                fs.writeFileSync(path.join(cache_dir, 'blah'), 'something');
                run(binPath + ' cache-clean --all', function(err,stdout,stderr) {
                    if(err) return on_error(err,stdout,stderr);
                    fs.readdir(cache_dir, function(err, files) {
                        if(err) throw err;
                        t.equal(files.length, 0);
                        t.end();
                    });
                });
            });
        });
    });
});
