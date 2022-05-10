'use strict';

// script changes the bucket name set in package.json of the test apps.

const fs = require('fs');
const path = require('path');

// http mock (lib/mock/http.js) sets 'npg-mock-bucket' as default bucket name.
// when providing no bucket name as argument, script will set
// all apps back to default mock settings.
const bucket = process.argv[2] || 'npg-mock-bucket';

const root = '../test';
const rootPath = path.resolve(__dirname, root);
const dirs = fs.readdirSync(rootPath).filter((fileorDir) => fs.lstatSync(path.resolve(rootPath, fileorDir)).isDirectory());

dirs.forEach((dir) => {
  const pkg = require(`${root}/${dir}/package.json`); // relative path

  // bucket specified as part of s3 virtual host format (auto detected by node-pre-gyp)
  const keys = ['host', 'staging_host', 'production_host'];
  keys.forEach((item) => {
    if (pkg.binary[item]) {

      // match the bucket part of the url
      const match = pkg.binary[item].match(/^https:\/\/(.+)(?:\.s3[-.].*)$/i);
      if (match) {
        pkg.binary[item] = pkg.binary[item].replace(match[1], bucket);
        console.log(`Success: set ${dir} ${item} to ${pkg.binary[item]}`);
      }
    }
  });
  // bucket is specified explicitly
  if (pkg.binary.bucket) {
    pkg.binary.bucket = bucket;
    console.log(`Set ${dir} bucket to ${pkg.binary.bucket}`);
  }

  // make sure bucket name is set in the package (somewhere) else this is an obvious error.
  // most likely due to manual editing of the json resulting in unusable format
  const str = JSON.stringify(pkg, null, 4);
  if (str.indexOf(bucket) !== -1) {
    fs.writeFileSync(path.join(path.resolve(rootPath, dir), 'package.json'), str + '\n');
  } else {
    throw new Error(`Error: could not set ${dir}. Manually check package.json`);
  }
});
