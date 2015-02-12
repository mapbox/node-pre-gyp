"use strict";

module.exports = exports = build;

exports.usage = 'Attempts to compile the module by dispatching to node-gyp or nw-gyp';

var fs = require('fs');
var compile = require('./util/compile.js');
var versioning = require('./util/versioning.js');
var fs = require('fs');

/*

Here we gather node-pre-gyp generated options (from versioning) and pass them along to node-gyp.

We massage the args and options slightly to account for differences in what commands mean between
node-pre-gyp and node-gyp (e.g. see the difference between "build" and "rebuild" below)

Keep in mind: the values inside `argv` and `gyp.opts` below are different depending on whether
node-pre-gyp is called directory, or if it is called in a `run-script` phase of npm.

We also try to preserve any command line options that might have been passed to npm or node-pre-gyp.
But this is fairly difficult without passing way to much through. For example `gyp.opts` contains all
the process.env and npm pushes a lot of variables into process.env which node-pre-gyp inherits. So we have
to be very selective about what we pass through.

For example:

`npm install --build-from-source` will give:

argv == [ 'rebuild' ]
gyp.opts.argv == { remain: [ 'install' ],
  cooked: [ 'install', '--fallback-to-build' ],
  original: [ 'install', '--fallback-to-build' ] }

`./bin/node-pre-gyp build` will give:

argv == []
gyp.opts.argv == { remain: [ 'build' ],
  cooked: [ 'build' ],
  original: [ '-C', 'test/app1', 'build' ] }

*/

// select set of node-pre-gyp versioning info
// to share with node-gyp
var share_with_node_gyp = [
  'module',
  'module_name',
  'module_path',
];

function build(gyp, argv, callback) {

    // Collect node-pre-gyp specific variables to pass to node-gyp
    var node_pre_gyp_options = [];
    // generate custom node-pre-gyp versioning info
    var opts = versioning.evaluate(JSON.parse(fs.readFileSync('./package.json')), gyp.opts);
    share_with_node_gyp.forEach(function(key) {
        var val = opts[key];
        if (val) {
            node_pre_gyp_options.push('--' + key + '=' + val);
        } else {
            return callback(new Error("Option " + key + " required but not found by node-pre-gyp"));
        }
    });

    // Collect options that follow the special -- which disables nopt parsing
    var unparsed_options = [];
    var double_hyphen_found = false;
    gyp.opts.argv.original.forEach(function(opt) {
        if (double_hyphen_found) {
            unparsed_options.push(opt);
        }
        if (opt == '--') {
            double_hyphen_found = true;
        }
    });

    // We try respect and pass through remaining command
    // line options (like --foo=bar) to node-gyp
    var cooked = gyp.opts.argv.cooked;
    var node_gyp_options = [];
    cooked.forEach(function(value) {
        if (value.length > 2 && value.slice(0,2) == '--') {
            var key = value.slice(2);
            var val = cooked[cooked.indexOf(value)+1];
            if (val && val.indexOf('--') === -1) { // handle '--foo=bar' or ['--foo','bar']
                node_gyp_options.push('--' + key + '=' + val);
            } else { // pass through --foo
                node_gyp_options.push(value);
            }
        }
    });

    var final_args = ['configure'].concat(node_gyp_options).concat(node_pre_gyp_options);
    var configure_options = [];
    if (unparsed_options.length > 0) {
        configure_options = final_args.
                      concat(['--']).
                      concat(unparsed_options);
    }

    // Form up commands to pass to node-gyp:
    // We map `node-pre-gyp build` to `node-gyp configure build` so that we do not
    // trigger a clean and therefore do not pay the penalty of a full recompile
    var node_gyp_command = 'build';
    if (argv.length && (argv.indexOf('rebuild') > -1)) {
        // here we map `node-pre-gyp rebuild` to `node-gyp rebuild` which internally means
        // "clean + configure + build" and triggers a full recompile
        node_gyp_command = 'rebuild';
    }

    compile.run_gyp(configure_options.concat(final_args),opts,function(err) {
        if (err) return callback(err);
        compile.run_gyp([node_gyp_command].concat(final_args).concat(node_pre_gyp_options),opts,function(err) {
            return callback(err);
        });

    });

}
