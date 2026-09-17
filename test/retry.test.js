'use strict';

const fs = require('fs');
const path = require('path');
const test = require('tape');
const nock = require('nock');
const install = require('../lib/install.js');

const {
  resolve_retry_opts,
  is_retryable_status,
  is_retryable_error,
  backoff_delay,
  DEFAULT_RETRIES,
  DEFAULT_RETRY_DELAY,
  DEFAULT_TIMEOUT,
  MAX_RETRY_DELAY
} = install.__test;

// Dummy tar.gz data - contains a blank directory
const targz = 'H4sICPr8u1oCA3gudGFyANPTZ6A5MDAwMDc1VQDTZhAaCGA0hGNobGRqZm5uZmxupGBgaGhiZsKgYMpAB1BaXJJYBHRKYk5pcioedeUZqak5+D2J5CkFhlEwCkbBKBjkAAAyG1ofAAYAAA==';

const projectRoot = path.join(__dirname, '..');
const origin = 'https://npg-mock-bucket.s3.us-east-1.amazonaws.com';

/**
 * Builds the tarball path matcher. Returns a fresh RegExp each call because nock matching against a shared instance
 * is stateful and mismatches intermittently.
 *
 * @returns {RegExp} Matcher for the app1 test tarball path.
 */
function tarballPath() {
  return /\/node-pre-gyp\/node-pre-gyp-test-app1\/v0.1.0\/Release\/node-v\d+-\S+.tar.gz/;
}

/**
 * Builds install options for the app1 fixture, pointed at the nock origin. Retry settings are passed through the same
 * gyp.opts path the feature uses, so a broken config copy shows up as a slow or failing test rather than a silent pass.
 *
 * @param {Object} [retryOpts] Retry settings to merge into opts, such as retries and retry_delay.
 * @returns {Object} Options object suitable for passing to install().
 */
function buildOpts(retryOpts = {}) {
  const opts = {
    opts: Object.assign({
      'build-from-source': false,
      'update-binary': true,
      retries: 3,
      retry_delay: 5
    }, retryOpts)
  };

  const appDir = path.join(projectRoot, 'test', 'app1');
  process.chdir(appDir);
  opts.package_json = JSON.parse(fs.readFileSync('./package.json'));
  opts.package_json.binary.host = origin;
  return opts;
}

test('retries a 500 and succeeds on the second attempt', (t) => {
  nock.cleanAll();
  const scope = nock(origin)
    .get(tarballPath()).reply(500, 'Internal Server Error')
    .get(tarballPath()).reply(200, Buffer.from(targz, 'base64'));

  install(buildOpts(), [], (err) => {
    t.ifError(err, 'install should succeed after retrying the 500');
    t.ok(scope.isDone(), 'both the failed and the successful request were made');

    nock.cleanAll();
    t.end();
  });
});

test('retries repeatedly while the host returns 503', (t) => {
  nock.cleanAll();
  const scope = nock(origin)
    .get(tarballPath()).reply(503, 'Service Unavailable')
    .get(tarballPath()).reply(503, 'Service Unavailable')
    .get(tarballPath()).reply(200, Buffer.from(targz, 'base64'));

  install(buildOpts({ retries: 3 }), [], (err) => {
    t.ifError(err, 'install should succeed on the third attempt');
    t.ok(scope.isDone(), 'all three requests were made');

    nock.cleanAll();
    t.end();
  });
});

test('retries a 504 gateway timeout', (t) => {
  nock.cleanAll();
  const scope = nock(origin)
    .get(tarballPath()).reply(504, 'Gateway Time-out')
    .get(tarballPath()).reply(200, Buffer.from(targz, 'base64'));

  install(buildOpts(), [], (err) => {
    t.ifError(err, 'install should succeed after retrying the 504');
    t.ok(scope.isDone(), 'both requests were made');

    nock.cleanAll();
    t.end();
  });
});

test('gives up after exhausting retries and reports the status code', (t) => {
  nock.cleanAll();
  const scope = nock(origin)
    .get(tarballPath()).reply(500, 'Internal Server Error')
    .get(tarballPath()).reply(500, 'Internal Server Error')
    .get(tarballPath()).reply(500, 'Internal Server Error');

  install(buildOpts({ retries: 2 }), [], (err) => {
    t.ok(err, 'install should fail once retries are exhausted');
    t.equal(err.statusCode, 500, 'error should carry statusCode for print_fallback_error');
    t.ok(err.message.includes('500'), 'error message should mention the status');
    t.ok(scope.isDone(), 'exactly three attempts were made');

    nock.cleanAll();
    t.end();
  });
});

test('reports statusCode on an exhausted 504, for the fallback diagnostic', (t) => {
  nock.cleanAll();
  const scope = nock(origin)
    .get(tarballPath()).reply(504, 'Gateway Time-out')
    .get(tarballPath()).reply(504, 'Gateway Time-out');

  install(buildOpts({ retries: 1 }), [], (err) => {
    t.ok(err, 'install should fail');
    t.equal(err.statusCode, 504, 'error should carry the 504 status code');
    t.ok(scope.isDone(), 'both attempts were made');

    nock.cleanAll();
    t.end();
  });
});

test('retries a 429 rate limit response', (t) => {
  nock.cleanAll();
  const scope = nock(origin)
    .get(tarballPath()).reply(429, 'Too Many Requests')
    .get(tarballPath()).reply(200, Buffer.from(targz, 'base64'));

  install(buildOpts(), [], (err) => {
    t.ifError(err, 'install should succeed after retrying the 429');
    t.ok(scope.isDone(), 'both requests were made');

    nock.cleanAll();
    t.end();
  });
});

test('does not retry a 404', (t) => {
  nock.cleanAll();
  const failing = nock(origin).get(tarballPath()).reply(404, 'Not Found');
  const followUp = nock(origin).get(tarballPath()).reply(200, Buffer.from(targz, 'base64'));

  install(buildOpts(), [], (err) => {
    t.ok(err, 'install should fail on 404');
    t.equal(err.statusCode, 404, 'error should carry the 404 status code');
    t.ok(failing.isDone(), 'the 404 request was made');
    t.notOk(followUp.isDone(), 'no second request was made');

    nock.cleanAll();
    t.end();
  });
});

test('does not retry a 403, leaving the authenticated path to handle it', (t) => {
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
  delete process.env.node_pre_gyp_mock_s3;

  nock.cleanAll();
  const failing = nock(origin).get(tarballPath()).reply(403, 'Forbidden');
  const followUp = nock(origin).get(tarballPath()).reply(403, 'Forbidden');

  install(buildOpts({ retries: 3 }), [], (err) => {
    t.ok(err, 'install should fail without credentials');
    t.equal(err.statusCode, 403, 'error should carry the 403 status code');
    t.ok(err.message.includes('AWS credentials not found'), 'should route to the authenticated path');
    t.ok(failing.isDone(), 'the 403 request was made');
    t.notOk(followUp.isDone(), 'the 403 was not retried');

    nock.cleanAll();
    t.end();
  });
});

test('retries a network error carrying a transient code', (t) => {
  nock.cleanAll();
  const scope = nock(origin)
    .get(tarballPath()).replyWithError({ code: 'ECONNRESET', message: 'read ECONNRESET' })
    .get(tarballPath()).reply(200, Buffer.from(targz, 'base64'));

  install(buildOpts(), [], (err) => {
    t.ifError(err, 'install should succeed after retrying the reset connection');
    t.ok(scope.isDone(), 'both requests were made');

    nock.cleanAll();
    t.end();
  });
});

test('retries a bare socket hang up with no error code', (t) => {
  nock.cleanAll();
  const scope = nock(origin)
    .get(tarballPath()).replyWithError(new Error('socket hang up'))
    .get(tarballPath()).reply(200, Buffer.from(targz, 'base64'));

  install(buildOpts(), [], (err) => {
    t.ifError(err, 'install should succeed after retrying the hang up');
    t.ok(scope.isDone(), 'both requests were made');

    nock.cleanAll();
    t.end();
  });
});

test('does not retry ENOTFOUND', (t) => {
  nock.cleanAll();
  const failing = nock(origin)
    .get(tarballPath())
    .replyWithError({ code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND' });
  const followUp = nock(origin).get(tarballPath()).reply(200, Buffer.from(targz, 'base64'));

  install(buildOpts(), [], (err) => {
    t.ok(err, 'install should fail on a DNS miss');
    t.ok(failing.isDone(), 'the failing request was made');
    t.notOk(followUp.isDone(), 'no second request was made');

    nock.cleanAll();
    t.end();
  });
});

test('retries a request that exceeds the per-attempt timeout', (t) => {
  nock.cleanAll();
  const scope = nock(origin)
    .get(tarballPath()).delayConnection(200).reply(200, Buffer.from(targz, 'base64'))
    .get(tarballPath()).reply(200, Buffer.from(targz, 'base64'));

  install(buildOpts({ timeout: 20 }), [], (err) => {
    t.ifError(err, 'install should succeed after the slow attempt times out');
    t.ok(scope.isDone(), 'both requests were made');

    nock.cleanAll();
    t.end();
  });
});

test('retries: 0 disables retrying', (t) => {
  nock.cleanAll();
  const failing = nock(origin).get(tarballPath()).reply(500, 'Internal Server Error');
  const followUp = nock(origin).get(tarballPath()).reply(200, Buffer.from(targz, 'base64'));

  install(buildOpts({ retries: 0 }), [], (err) => {
    t.ok(err, 'install should fail immediately');
    t.equal(err.statusCode, 500, 'error should carry the 500 status code');
    t.ok(failing.isDone(), 'the failing request was made');
    t.notOk(followUp.isDone(), 'no retry was attempted');

    nock.cleanAll();
    t.end();
  });
});

test('is_retryable_status matches the retry decision table', (t) => {
  [429, 500, 502, 503, 504, 599].forEach((status) => {
    t.ok(is_retryable_status(status), `${status} should be retryable`);
  });
  [200, 301, 400, 401, 403, 404, 410, 418].forEach((status) => {
    t.notOk(is_retryable_status(status), `${status} should not be retryable`);
  });
  t.end();
});

test('is_retryable_error matches the retry decision table', (t) => {
  ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH']
    .forEach((code) => {
      t.ok(is_retryable_error({ code }), `${code} should be retryable`);
    });

  t.notOk(is_retryable_error({ code: 'ENOTFOUND' }), 'ENOTFOUND should not be retryable');
  t.notOk(is_retryable_error(null), 'a missing error should not be retryable');
  t.notOk(is_retryable_error({ name: 'AbortError' }), 'a deliberate abort should not be retryable');
  t.notOk(is_retryable_error(new Error('something else entirely')), 'an unknown error should not be retryable');
  t.ok(is_retryable_error({ type: 'request-timeout' }), 'a node-fetch request timeout should be retryable');
  t.ok(is_retryable_error({ type: 'body-timeout' }), 'a node-fetch body timeout should be retryable');
  t.ok(is_retryable_error(new Error('socket hang up')), 'a socket hang up should be retryable');
  t.end();
});

test('resolve_retry_opts falls back to defaults', (t) => {
  t.deepEqual(resolve_retry_opts({}), {
    retries: DEFAULT_RETRIES,
    retryDelay: DEFAULT_RETRY_DELAY,
    timeout: DEFAULT_TIMEOUT
  }, 'an empty opts object yields the defaults');

  t.deepEqual(resolve_retry_opts({ retries: 5, retry_delay: 10, timeout: 99 }), {
    retries: 5,
    retryDelay: 10,
    timeout: 99
  }, 'explicit options win');

  t.deepEqual(resolve_retry_opts({ node_pre_gyp_retries: '4', node_pre_gyp_timeout: '50' }), {
    retries: 4,
    retryDelay: DEFAULT_RETRY_DELAY,
    timeout: 50
  }, 'npm-style string config is parsed');

  t.equal(resolve_retry_opts({ retries: 0 }).retries, 0, 'zero retries is honoured as a disable');
  t.end();
});

test('resolve_retry_opts rejects malformed config rather than producing NaN', (t) => {
  const malformed = resolve_retry_opts({ retries: 'lots', retry_delay: 'soon', timeout: 'never' });
  t.equal(malformed.retries, DEFAULT_RETRIES, 'unparseable retries falls back to the default');
  t.equal(malformed.retryDelay, DEFAULT_RETRY_DELAY, 'unparseable delay falls back to the default');
  t.equal(malformed.timeout, DEFAULT_TIMEOUT, 'unparseable timeout falls back to the default, not 0');

  const negative = resolve_retry_opts({ retries: -1, retry_delay: -1, timeout: -1 });
  t.equal(negative.retries, DEFAULT_RETRIES, 'negative retries falls back to the default');
  t.equal(negative.retryDelay, DEFAULT_RETRY_DELAY, 'negative delay falls back to the default');
  t.equal(negative.timeout, DEFAULT_TIMEOUT, 'negative timeout falls back to the default');
  t.end();
});

test('backoff_delay grows exponentially and stays within its ceiling', (t) => {
  for (let attempt = 0; attempt < 6; attempt++) {
    const ceiling = Math.min(1000 * Math.pow(2, attempt), MAX_RETRY_DELAY);
    const samples = Array.from({ length: 200 }, () => backoff_delay(attempt, 1000));
    const outOfRange = samples.filter((delay) => delay < 0 || delay >= ceiling);
    t.equal(outOfRange.length, 0, `attempt ${attempt}: all samples within [0, ${ceiling})`);
    t.ok(Math.max(...samples) > ceiling / 4, `attempt ${attempt}: jitter reaches the upper part of the range`);
  }

  const capped = Array.from({ length: 200 }, () => backoff_delay(100, 1000));
  t.ok(Math.max(...capped) <= MAX_RETRY_DELAY, 'a large attempt count stays capped');
  t.end();
});
