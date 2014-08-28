// Fetch the right hosting implementation for given options
// first look for an implementation embedded into the project then in an outside module
module.exports = function(opts){
	var hosting;
	try {
		hosting = require('./hosting-' + opts.hosting.provider);
	} catch(e) {
		hosting = require('node-pre-gyp-hosting-' + opts.hosting.provider);
	}
	return hosting;
};