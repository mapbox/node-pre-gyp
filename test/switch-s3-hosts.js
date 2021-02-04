'use strict';

//
// utility to facilitate testing when not running as repo owner in the repo.
// this replaces the mapbox-specific s3 URLs with an URL pointing to an S3
// bucket to which i can write to. each person using this will need to supply
// their own s3 buckets (and set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
// appropriately).
//
// please reset to the mapbox settings before committing.
//

const fs = require('fs');
const walk = require('action-walk');

const [maj, min] = process.versions.node.split('.');
if (`${maj}.${min}` < 10.17) {
  console.error('requires node >= 10.17');
  process.exit(1);
}
if (process.argv[2] !== 'toLocal' && process.argv[2] !== 'toMapbox') {
  console.error('argument must be toLocal or toMapbox, not', process.argv[2]);
  process.exit(1);
}

const direction = {
  toLocal: {
    source: /https:\/\/mapbox-node-pre-gyp-public-testing-bucket\.s3\.us-east-1\.amazonaws\.com/g,
    target: 'https://bmac-pre-gyp-test.s3.us-east-1.amazonaws.com'
  },
  toMapbox: {
    source: /https:\/\/bmac-pre-gyp-test\.s3\.us-east-1\.amazonaws\.com/g,
    target: 'https://mapbox-node-pre-gyp-public-testing-bucket.s3.us-east-1.amazonaws.com'
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
  if (path.endsWith('/package.json') || path.endsWith('/fetch.test.js')) {
    const file = fs.readFileSync(path, 'utf8');
    const changed = file.replace(repl.source, repl.target);
    if (file !== changed) {
      console.log('replacing in:', path);
      // eslint-disable-next-line node/no-unsupported-features/node-builtins
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
