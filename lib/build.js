
module.exports = exports = build

exports.usage = 'Attempts to compile the module by dispatching to node-gyp or nw-gyp'

var fs = require('fs')
  , compile = require('./util/compile.js')
  , versioning = require('./util/versioning.js')
  , path = require('path')
  , fs = require('fs')
  , mkdirp = require('mkdirp')

function build(gyp, argv, callback) {
    var gyp_args = [];
    if (argv.length && argv[0] == 'rebuild') {
        gyp_args.push('rebuild');
    } else {
        gyp_args.push('configure');
        gyp_args.push('build');
    }
    var package_json = JSON.parse(fs.readFileSync('./package.json'));
    // options look different depending on whether node-pre-gyp is called directly
    // or whether it is called from npm install, hence the following two lines.
    var command_line_opts = (typeof(gyp.opts.argv.original) === 'string') ? JSON.parse(gyp.opts.argv).original : gyp.opts.argv.original || [];
    command_line_opts = command_line_opts.filter(function(opt) { return opt.length > 2 && opt.slice(0,2) == '--'});
    var opts = versioning.evaluate(package_json, gyp.opts);
    command_line_opts.push('--versioning='+opts.versioned)
    console.log(command_line_opts)
    compile.run_gyp(gyp_args.concat(command_line_opts),gyp.opts,function(err,gopts) {
        if (err) return callback(err);
        // TODO - gyp should move into place itself: https://github.com/springmeyer/node-pre-gyp/issues/37
        var from = path.join(opts.module_path,opts.module_name + '.node');
        var to = path.join(opts.versioned_path,opts.module_name + '.node');
        fs.readFile(from,function(err,buf) {
            if (err) return callback(err);
            mkdirp(path.dirname(to),function(err) {
                if (err) return callback(err);
                fs.writeFile(to,buf,function(err) {
                    return callback(err);
                })
            })
        })
    });
}
