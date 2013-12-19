#!/bin/bash

set -e -u

# put npm's copy of node-gyp on the PATH
export PATH=`npm explore npm -g -- pwd`/bin/node-gyp-bin/:$PATH

ROOTDIR=`pwd`/test

function mark {
    echo
    echo "*** $1 ($2) ***"
    echo
}
function build_app {
    cd $ROOTDIR/$1
    # test normal install
    rm -rf build
    mark 1 $1
    ../../bin/node-pre-gyp.js rebuild $2
    mark 2 $1
    npm install rebuild $2
    node index.js

    # test source build
    rm -rf build
    mark 3 $1
    ../../bin/node-pre-gyp.js rebuild $2 --build-from-source
    mark 4 $1
    npm install rebuild $2 --build-from-source
    node index.js

    # test packaging
    rm -rf build
    rm -rf stage
    mark 5 $1
    ../../bin/node-pre-gyp.js package $2 --verbose
    rm -rf build
    rm -rf $3/$1.node
    mkdir -p $3
    tar xf stage/*.tar.gz -O > $3/$1.node
    mark 6 $1
    node index.js

    # cleanup
    rm -rf {build,stage,node_modules}
    rm -rf lib/*node
    cd ${ROOTDIR}
}

build_app "app1" "" "build/Release"
build_app "app2" "--custom_include_path=`pwd`/app2/include" "lib"