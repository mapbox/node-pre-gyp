var assert = require('assert');
var cp = require('child_process')
var path = require('path');
var existsSync = require('fs').existsSync || require('path').existsSync;

var cmd_path = path.join(__dirname,'../bin/');
process.env.PATH = cmd_path+':'+process.env.PATH;
process.env.NODE_PATH = path.join(__dirname,'../lib/');

function run(command,app,cb) {
    command += ' -C ' + path.join(__dirname,app.name);
    command += ' ' + app.args;
    cp.exec(command,cb);
}

var apps = [
    {
        'name': 'app1',
        'args': ''
    }
    ,{
        'name': 'app2',
        'args': '--custom_include_path=../include'
    }
    ,{
        'name': 'app2',
        'args': '--custom_include_path=../include --debug'
    }
    ,{
        'name': 'app3',
        'args': ''
    }
    ,{
        'name': 'app4',
        'args': ''
    }
]

describe('build', function() {
    apps.forEach(function(app) {
        it('should build '+ app.name + ' ' + app.args, function(done) {
            run('node-pre-gyp rebuild --fallback-to-build', app, function(err,stdout,stderr) {
                if (err) throw err;
                assert.ok(stdout.search('COPY') > -1);
                assert.ok(stdout.search(app.name+'.node') > -1);
                assert.equal(stderr,'');
                run('node-pre-gyp reveal module_path', app, function(err,stdout,stderr) {
                    if (err) throw err;
                    assert.equal(stderr,'');
                    var module_path = stdout.trim();
                    assert.ok(module_path.search(app.name) > -1);
                    assert.ok(existsSync(module_path));
                    var module_binary = path.join(module_path,app.name+'.node');
                    assert.ok(existsSync(module_binary));
                    run('npm test', app, function(err,stdout,stderr) {
                        if (err) throw err;
                        assert.equal(stderr,'');
                        assert.notEqual(stdout,'');
                        done();
                    });
                });
            })
        });
    });
});
