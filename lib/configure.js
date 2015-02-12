"use strict";

module.exports = exports = configure;

exports.usage = 'Attempts to configure node-gyp or nw-gyp build';

var fs = require('fs');
var compile = require('./util/compile.js');
var versioning = require('./util/versioning.js');
var handle_gyp_opts = require('./util/handle_gyp_opts.js');

function configure(gyp, argv, callback) {

    handle_gyp_opts(gyp,argv,function(err,result) {
        var node_gyp_options = result.gyp;
        var node_pre_gyp_options = result.pre;
        var unparsed_options = result.unparsed;

        var final_args = ['configure'].concat(node_gyp_options).concat(node_pre_gyp_options);
        if ((gyp.ignore_unparsed !== undefined && gyp.ignore_unparsed !== true) && unparsed_options.length > 0) {
            final_args = final_args.
                          concat(['--']).
                          concat(unparsed_options);
        }

        compile.run_gyp(final_args,result.opts,function(err) {
            return callback(err);
        });

    });
}
