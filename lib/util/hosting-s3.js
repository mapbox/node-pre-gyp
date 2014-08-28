var path = require('path');
var fs = require('fs');
var request = require('request');
var log = require('npmlog');
var s3_setup = require('./util/s3_setup.js');

/**
 * Upload a tarball packaged by node-pre-gyp to AWS S3
 *
 * @param {Object} opts - A options object as return by node-pre-gyp's versioning.evaluate()
 * @param {Object} config - A config object as built by node-pre-gyp using the rc configuration module
 * @param {Function} callback - No particular return, just err or no err
 */
exports.publish = function(opts, config, callback) {
	var AWS = require("aws-sdk");
	s3_setup.detect(opts.hosted_path, config);
	var key_name = url.resolve(config.prefix, opts.package_name);
	AWS.config.update(config);
	var s3 = new AWS.S3();
	var s3_opts = {
		Bucket: config.bucket,
		Key: key_name
	};
	s3.headObject(s3_opts, function(err, meta) {
		if (err && err.code == 'NotFound') {
			// we are safe to publish because
			// the object does not already exist
			var s3 = new AWS.S3();
			var s3_obj_opts = {
				ACL: config.acl,
				Body: fs.createReadStream(tarball),
				Bucket: config.bucket,
				Key: key_name
			};
			s3.putObject(s3_obj_opts, function(err, resp) {
				if (err) return callback(err);
				console.log('[' + package_json.name + '] Success: published to https://' + s3_opts.Bucket + '.s3.amazonaws.com/' + s3_opts.Key);
				return callback();
			});
		} else if (err) {
			return callback(err);
		} else {
			log.error('publish', 'Cannot publish over existing version');
			log.error('publish', "Update the 'version' field in package.json and try again");
			log.error('publish', 'If the previous version was published in error see:');
			log.error('publish', '\t node-pre-gyp unpublish');
			return callback(new Error('Failed publishing to https://' + s3_opts.Bucket + '.s3.amazonaws.com/' + s3_opts.Key));
		}
	});
};

/**
 * Remove a tarball packaged by node-pre-gyp that was previously uploaded as an asset to a AWS S3
 *
 * @param {Object} opts - An options object as return by node-pre-gyp's versioning.evaluate()
 * @param {Object} config - A config object as built by node-pre-gyp using the rc configuration module
 * @param {Function} callback - No particular return, just err or no err
 */
exports.unpublish = function(opts, config, callback) {
	var AWS = require("aws-sdk");
	s3_setup.detect(opts.hosted_path, config);
	AWS.config.update(config);
	var key_name = url.resolve(config.prefix, opts.package_name);
	var s3 = new AWS.S3();
	var s3_opts = {
		Bucket: config.bucket,
		Key: key_name
	};
	s3.headObject(s3_opts, function(err, meta) {
		if (err && err.code == 'NotFound') {
			console.log('[' + package_json.name + '] Not found: https://' + s3_opts.Bucket + '.s3.amazonaws.com/' + s3_opts.Key);
			return callback();
		} else if (err) {
			return callback(err);
		} else {
			log.info(JSON.stringify(meta));
			s3.deleteObject(s3_opts, function(err, resp) {
				if (err) return callback(err);
				log.info(JSON.stringify(resp));
				console.log('[' + package_json.name + '] Success: removed https://' + s3_opts.Bucket + '.s3.amazonaws.com/' + s3_opts.Key);
				return callback();
			});
		}
	});
};

/**
 * Download a tarball packaged by node-pre-gyp that was previously uploaded to AWS S3
 *
 * @param {Object} opts - An options object as return by node-pre-gyp's versioning.evaluate()
 * @param {Function} callback - called with a request object (https://github.com/mikeal/request) that will be used as a stream by node-pre-gyp
 */
exports.download = function(opts, callback) {
	var uri = opts.hosted_tarball;
	log.http('GET', uri);

	var req = null;
	var requestOpts = {
		uri: uri,
		headers: {
			'User-Agent': 'node-pre-gyp (node ' + process.version + ')'
		}
	};

	var proxyUrl = opts.proxy || process.env.http_proxy || process.env.HTTP_PROXY || process.env.npm_config_proxy;
	if (proxyUrl) {
		if (/^https?:\/\//i.test(proxyUrl)) {
			log.verbose('download', 'using proxy url: "%s"', proxyUrl);
			requestOpts.proxy = proxyUrl;
		} else {
			log.warn('download', 'ignoring invalid "proxy" config setting: "%s"', proxyUrl);
		}
	}
	try {
		req = request(requestOpts);
	} catch (e) {
		return callback(e);
	}
	if (req) {
		req.on('response', function(res) {
			log.http(res.statusCode, uri);
		});
	}
	return callback(null, req);
};