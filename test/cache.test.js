"use strict";

var assert = require('assert');
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

(/^v0.10/.test(process.version) ? describe.skip : describe)('caching', function() {
    before(function (done) {
        // cleanup
        fs.mkdir(cache_dir, function(err) {
            if(err && err.code !== 'EEXIST') throw err;
            done();
        });
    });

    beforeEach(function(done) {
        fs.readdir(cache_dir, function(err, files) {
            if(err) throw err;
            files.forEach(function(file) {
                fs.unlinkSync(path.join(cache_dir,file));
            });
            done();
        });
    });

    it('populates the cache when file is missing', function(done) {
        install(function(err,stdout,stderr) {
            if(err) return on_error(err,stdout,stderr);
            fs.readdir(cache_dir, function(err, files) {
                if(err) throw err;
                assert.equal(files.length, 1);
                done();
            });
        });
    });

    it('uses the cache', function(done) {
        install(function(err,stdout,stderr) {
            if(err) return on_error(err,stdout,stderr);
            fs.readdir(cache_dir, function(err, files) {
                if(err) throw err;
                var mtime = fs.statSync(path.join(cache_dir,files[0])).mtime;
                install(install_cmd + ' --loglevel=verbose', function(err,stdout,stderr) {
                    assert.ok(stderr.indexOf('from cache') > -1);
                    assert.equal(stderr.indexOf('http'), -1);
                    assert.equal(fs.statSync(path.join(cache_dir,files[0])).mtime.getTime(), mtime.getTime(), 'cache value was not updated');
                    done();
                });
            });
        });
    });

    it('ignores the cache if it is invalid', function(done) {
        install(function(err,stdout,stderr) {
            if(err) return on_error(err,stdout,stderr);
            fs.readdir(cache_dir, function(err, files) {
                if(err) throw err;
                files.forEach(function(file) { fs.writeFileSync(path.join(cache_dir,file), 'NOT A TAR'); });
                install(function(err,stdout,stderr) { // cache now contains bad files
                    if(err) return on_error(err,stdout,stderr);
                    fs.readdir(cache_dir, function(err, files) {
                        files.forEach(function(file) {
                            assert.notEqual(fs.readFileSync(path.join(cache_dir,file),'utf8'),'NOT A TAR','bad cache is replaced');
                        }); // bad cache value replaced with a good one
                        done();
                    });
                });
            });
        });
    });

    it('ignores the cache if told to', function(done) {
        install(function(err,stdout,stderr) {
            if(err) return on_error(err,stdout,stderr);
            fs.readdir(cache_dir, function(err, files) { // populate cache
                if(err) throw err;
                var mtime = fs.statSync(path.join(cache_dir,files[0])).mtime;
                install(install_cmd + ' --ignore-node-pre-gyp-cache', function(err,stdout,stderr) {
                    if(err) return on_error(err,stdout,stderr);
                    assert.equal(stderr.indexOf('from cache'), -1);
                    assert.ok(fs.statSync(path.join(cache_dir,files[0])).mtime.getTime() > mtime.getTime(), 'cache value was not used, but was instead updated');
                    done();
                });
            });
        });
    });

    it('ignores the cache and doesn\'t update it if told to', function(done) {
        install(function(err,stdout,stderr) {
            if(err) return on_error(err,stdout,stderr);
            fs.readdir(cache_dir, function(err, files) { // populate cache
                if(err) throw err;
                var mtime = fs.statSync(path.join(cache_dir,files[0])).mtime;
                install(install_cmd + ' --ignore-node-pre-gyp-cache --skip-node-pre-gyp-cache', function(err,stdout,stderr) {
                    if(err) return on_error(err,stdout,stderr);
                    assert.equal(stderr.indexOf('from cache'), -1);
                    assert.equal(fs.statSync(path.join(cache_dir,files[0])).mtime.getTime(), mtime.getTime(), 'cache value was not updated');
                    done();
                });
            });
        });
    });

    it('proceeds even when the cache dir can\'t be accessed/created', function(done) {
        install(install_cmd + ' --loglevel=verbose', { NODE_PRE_GYP_CACHE: path.join(cache_dir, 'x', 'x') }, function(err,stdout,stderr) {
            if(err) return on_error(err,stdout,stderr);
            assert.ok(stderr.indexOf('http') > -1, 'fetched binding');
            done();
        });
    });

    it('populates the cache with a local build', function(done) {
        run(binPath + ' rebuild --fallback-to-build --loglevel=error', function(err,stdout,stderr) {
            if(err) return on_error(err,stdout,stderr);
            fs.readdir(cache_dir, function(err, files) {
                if(err) throw err;
                assert.equal(files.length, 1);
                done();
            });
        });
    });

    it('doesn\'t write to the cache when told not to', function(done) {
        run(binPath + ' rebuild --fallback-to-build --loglevel=error --skip-node-pre-gyp-cache', function(err,stdout,stderr) {
            if(err) return on_error(err,stdout,stderr);
            fs.readdir(cache_dir, function(err, files) {
                if(err) throw err;
                assert.equal(files.length, 0);
                done();
            });
        });
    });

    it('reuses a cached local build', function(done) {
        run(binPath + ' rebuild --fallback-to-build --loglevel=error', function(err,stdout,stderr) {
            if(err) return on_error(err,stdout,stderr);
            fs.readdir(cache_dir, function(err, files) {
                if(err) throw err;
                var mtime = fs.statSync(path.join(cache_dir,files[0])).mtime;
                install(install_cmd + ' --loglevel=verbose', function(err,stdout,stderr) {
                    assert.ok(stderr.indexOf('from cache') > -1);
                    assert.equal(stderr.indexOf('http'), -1);
                    assert.equal(fs.statSync(path.join(cache_dir,files[0])).mtime.getTime(), mtime.getTime(), 'cache value was not updated');
                    done();
                });
            });
        });
    });

    describe('clean', function() {
        it('can clean the cache', function(done) {
            install(function(err,stdout,stderr) {
                if(err) return on_error(err,stdout,stderr);
                fs.readdir(cache_dir, function(err, files) {
                    if(err) throw err;
                    assert.equal(files.length, 1);
                    run(binPath + ' cache-clean', function(err,stdout,stderr) {
                        if(err) return on_error(err,stdout,stderr);
                        fs.readdir(cache_dir, function(err, files) {
                            if(err) throw err;
                            assert.equal(files.length, 0);
                            done();
                        });
                    });
                });
            });
        });

        it('doesn\'t remove non-tarballs from the cache', function(done) {
            install(function(err,stdout,stderr) {
                if(err) return on_error(err,stdout,stderr);
                fs.writeFileSync(path.join(cache_dir, 'blah'), 'something');
                if(err) throw err;
                run(binPath + ' cache-clean', function(err,stdout,stderr) {
                    if(err) return on_error(err,stdout,stderr);
                    fs.readdir(cache_dir, function(err, files) {
                        if(err) throw err;
                        assert.equal(files.length, 1);
                        done();
                    });
                });
            });
        });

        it('can be told to remove everything from the cache', function(done) {
            install(function(err,stdout,stderr) {
                if(err) return on_error(err,stdout,stderr);
                fs.writeFileSync(path.join(cache_dir, 'blah'), 'something');
                run(binPath + ' cache-clean --all', function(err,stdout,stderr) {
                    if(err) return on_error(err,stdout,stderr);
                    fs.readdir(cache_dir, function(err, files) {
                        if(err) throw err;
                        assert.equal(files.length, 0);
                        done();
                    });
                });
            });
        });
    });
});
