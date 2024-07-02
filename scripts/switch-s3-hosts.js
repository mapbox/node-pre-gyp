'use strict';

//
// utility to switch s3 targets for local testing. if the s3 buckets are left
// pointing to the mapbox-node-pre-gyp-public-testing-bucket and you don't have
// write permissions to those buckets then the tests will fail. switching the
// target allows the tests to be run locally (even though the CI tests will fail
// if you are not a collaborator to the mapbox/node-pre-gyp repository).
//
// this replaces the mapbox-specific s3 URLs with an URL pointing to an S3
// bucket which can be written to. each person using this will need to supply
// their own `toLocal.target` and `toMapbox.source` values that refer to their
// s3 buckets (and set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
// appropriately).
//
// reset to the mapbox settings before committing.
//

const fs = require('fs');
const walk = require('action-walk'); // eslint-disable-line n/no-missing-require

const [maj, min] = process.versions.node.split('.');
if (`${maj}.${min}` < 10.1) {
  console.error('requires node >= 10.1 for fs.promises');
  process.exit(1);
}
if (process.argv[2] !== 'toLocal' && process.argv[2] !== 'toMapbox') {
  console.error('argument must be toLocal or toMapbox, not', process.argv[2]);
  process.exit(1);
}

const direction = {
  toLocal: {
    source: /mapbox-node-pre-gyp-public-testing-bucket/g,
    target: 'bmac-pre-gyp-test'
  },
  toMapbox: {
    source: /bmac-pre-gyp-test/g,
    target: 'mapbox-node-pre-gyp-public-testing-bucket'
  }
};

const repl = direction[process.argv[2]];

console.log('replacing:');
console.log('   ', repl.source);
console.log('with:');
console.log('   ', repl.target);


function dirAction(path) {
  if (path.startsWith('./node_modules/')) {
    return 'skip';
  }
}

function fileAction(path) {
  if (path.endsWith('/package.json') || path.endsWith('/fetch.test.js') || path.endsWith('/lib/util/s3_setup.js')) {
    const file = fs.readFileSync(path, 'utf8');
    const changed = file.replace(repl.source, repl.target);
    if (file !== changed) {
      console.log('replacing in:', path);
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      return fs.promises.writeFile(path, changed);
    } else {
      console.log('target not found in:', path);
    }
  }
}

const options = {
  dirAction,
  fileAction
};

walk('.', options);
