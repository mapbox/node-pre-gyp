#!/bin/bash

# put npm's copy of node-gyp on the PATH
export PATH=`npm explore npm -g -- pwd`/bin/node-gyp-bin/:$PATH

ROOTDIR=`pwd`/test

function build_app {
    cd $ROOTDIR/$1
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
    rm -rf stage
    ../../bin/node-pre-gyp.js package
    rm -rf build
    mkdir -p build/Release
    tar xf stage/*.tar.gz -O > build/Release/$1.node
    node index.js
}

build_app "app1"