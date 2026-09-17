'use strict';

// script upgrades node-gyp when the bundled copy is too old to detect the installed Visual Studio. node-gyp
// recognises Visual Studio 2026 (major version 18) only from v12 onwards, so older copies fail to configure on runner
// images shipping it.

const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const compile = require('../lib/util/compile.js');

const MINIMUM_MAJOR = 12;
const INSTALL_VERSION = '13.0.2';

const node_gyp_bin = compile.which_node_gyp();
if (!node_gyp_bin) {
  console.log('could not locate node-gyp; leaving it alone');
  process.exit(0);
}

const { version } = require(path.join(node_gyp_bin, '../../package.json'));
console.log(`found node-gyp@${version} at ${node_gyp_bin}`);

if (parseInt(version, 10) >= MINIMUM_MAJOR) {
  console.log(`node-gyp@${version} detects Visual Studio 2026; nothing to do`);
  process.exit(0);
}

console.log(`node-gyp@${version} predates v${MINIMUM_MAJOR}; installing node-gyp@${INSTALL_VERSION}`);
cp.execFileSync('npm', ['install', '--no-save', `node-gyp@${INSTALL_VERSION}`], { stdio: 'inherit', shell: true });

const upgraded = path.join(__dirname, '../node_modules/node-gyp/bin/node-gyp.js');
console.log(`using node-gyp at ${upgraded}`);

// export for later GitHub workflow steps, which npm would otherwise point back at its own bundled copy
if (process.env.GITHUB_ENV) {
  fs.appendFileSync(process.env.GITHUB_ENV, `npm_config_node_gyp=${upgraded}\n`);
}
