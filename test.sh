#!/bin/bash

set -e -u
# set -x

# put npm's copy of node-gyp on the PATH
export PATH=`npm explore npm -g -- pwd`/bin/node-gyp-bin:$PATH
export PATH=`pwd`/bin:$PATH

ROOTDIR=`pwd`/test

function setup {
    if [ ! -d ${ROOTDIR}/app3/hello-gyp ]; then
        cd ${ROOTDIR}/app3/
        git clone https://github.com/springmeyer/hello-gyp.git
    fi
    cd ${ROOTDIR}
}

function teardown {
    if [ -d ${ROOTDIR}/app3/hello-gyp ]; then
        rm -rf ${ROOTDIR}/app3/hello-gyp
    fi
}

function mark {
    echo
    echo "*** $1 ($2) ***"
    echo
}

function build_app {
    cd $ROOTDIR/$1
    # test normal install
    node-pre-gyp clean
    mark 1 $1
    node-pre-gyp rebuild $2
    mark 2 $1
    npm install rebuild $2
    npm test

    # test source build
    node-pre-gyp clean
    mark 3 $1
    node-pre-gyp rebuild $2 --build-from-source
    mark 4 $1
    npm install rebuild $2 --build-from-source
    npm test

    # test packaging
    node-pre-gyp clean
    mark 5 $1
    node-pre-gyp rebuild package $2
    # pluck staged tarball out
    cp build/stage/*.tar.gz .
    node-pre-gyp clean
    rm -rf $3/$1.node
    mkdir -p $3
    tar xf ./*.tar.gz -O > $3/$1.node
    mark 6 $1
    npm test

    # cleanup
    rm -rf {build,node_modules}
    rm -rf lib/*node
    cd ${ROOTDIR}
}

setup
# simpliest, least config node c++ addon possible
build_app "app1" "" "build/Release"
# app with more custom organization and needing a variable passed for custom include path
build_app "app2" "--custom_include_path=`pwd`/app2/include" "lib"
# app that depends on an external library that provides a .gyp itself
build_app "app3" "" "lib"
teardown