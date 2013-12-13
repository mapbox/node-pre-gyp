#!/bin/bash

cd test/app1

# test normal install
rm -rf build
../../bin/node-pre-gyp.js rebuild
node index.js

# test source build
rm -rf build
../../bin/node-pre-gyp.js rebuild --build-from-source
node index.js

# test packaging
rm -rf build
../../bin/node-pre-gyp.js publish
rm -rf build
mkdir build/Release
tar xf stage/app1-v0.1.0-node-v11-darwin-x64.tar.gz -O > build/Release/app1.node
node index.js
