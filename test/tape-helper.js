#!/usr/bin/env node
'use strict';

const os = require('os');
const path = require('path');
const spawn = require('child_process').spawn;

const [node, script, ...argv] = process.argv.slice();

if (argv[0] !== 'tape') {
  throw new Error(`${script} can only help tape, not ${argv[0]}`);
}

argv[0] = `${process.cwd()}/node_modules/.bin/tape`;

const nodePath = node.slice(0, -'/node'.length);

const PATH = `${process.env.PATH}${path.delimiter}${nodePath}`;
const env = {
  PATH,
  node_pre_gyp_mock_s3: `${os.tmpdir()}/mock`
};

const opts = {
  env,
  stdio: 'inherit'
};

const child = spawn(node, argv, opts);

child.on('close', (code) => {
  process.exit(code);
});
