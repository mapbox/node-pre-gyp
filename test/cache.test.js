"use strict";

var assert = require('assert');
var path = require('path');
var fs = require('fs');
var cp = require('child_process');

var default_cmd = path.join(__dirname,'..','bin','node-pre-gyp') + ' install --update-binary --fallback-to-build=false';

var cache_dir = path.join(__dirname, 'cache');
var test_dir = path.join(__dirname, 'app1');

function install(cmd,opts,callback) {
    if(typeof cmd === 'function') {
        callback = cmd;
        cmd = default_cmd;
    }
    if(typeof opts === 'function') {
        callback = opts;
        opts = null;
    }
    var test_env = Object.assign({}, process.env, { NODE_PRE_GYP_CACHE: cache_dir }, opts);
    cp.exec(cmd, { cwd: test_dir, env: test_env }, callback);
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
            fs.readdir(cache_dir, function(err, files) {
                if(err) throw err;
                files.forEach(function(file) {
                    fs.unlinkSync(path.join(cache_dir,file));
                });
                done();
            });
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
                install(default_cmd + ' --loglevel=verbose', function(err,stdout,stderr) {
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
                install(default_cmd + ' --ignore-cache', function(err,stdout,stderr) {
                    if(err) return on_error(err,stdout,stderr);
                    assert.equal(stderr.indexOf('from cache'), -1);
                    fs.readdir(cache_dir, function(err, files) {
                        assert.ok(fs.statSync(path.join(cache_dir,files[0])).mtime.getTime() > mtime.getTime(), 'cache value was not used, but was instead updated');
                        done();
                    });
                });
            });
        });
    });

    it('proceeds even when the cache dir can\'t be accessed/created', function(done) {
        install(default_cmd + ' --loglevel=verbose', { NODE_PRE_GYP_CACHE: path.join(cache_dir, 'x', 'x') }, function(err,stdout,stderr) {
            if(err) return on_error(err,stdout,stderr);
            assert.ok(stderr.indexOf('http') > -1, 'fetched binding');
            done();
        });
    });
});
