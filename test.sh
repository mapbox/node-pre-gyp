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
        git clone --depth=0 https://github.com/springmeyer/hello-gyp.git
    fi
    cd ${ROOTDIR}
}

function teardown {
    if [ -d ${ROOTDIR}/app3/hello-gyp ]; then
        rm -rf ${ROOTDIR}/app3/hello-gyp
    fi
}

function MARK {
    echo
    echo "*** $1 ($2) ***"
    echo
}

function build_app {
    cd $ROOTDIR/$1

    MARK 1 $1
    # test install from binary with fallback
    # run directly against node-pre-gyp
    node-pre-gyp clean
    node-pre-gyp install --fallback-to-build $2
    npm test

    MARK 2 $1
    # it works, so now publish
    node-pre-gyp package publish $2
    node-pre-gyp clean

    MARK 3 $1
    # now test installing via remote binary without fallback
    node-pre-gyp install $2
    npm test

    MARK 4 $1
    # it works, so now try doing again, but via npm
    node-pre-gyp clean
    npm install $2
    npm test

    # TODO - unpublish

    MARK 5 $1
    # test source build
    node-pre-gyp clean
    node-pre-gyp build $2
    npm test

    MARK 6 $1
    # test source build via npm
    npm install $2 --build-from-source
    npm test

    MARK 7 $1
    # test packaging
    node-pre-gyp package $2
    # pluck staged tarball out
    cp build/stage/*.tar.gz .
    node-pre-gyp clean
    rm -rf $3/$1.node
    mkdir -p $3
    # put tarball back in place
    tar xf ./*.tar.gz -O > $3/$1.node
    npm test

    # cleanup
    rm ./*.tar.gz
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