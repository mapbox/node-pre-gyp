#!/bin/bash

set -e -u
# set -x

# put npm's copy of node-gyp on the PATH
export PATH=`npm explore npm -g -- pwd`/bin/node-gyp-bin:$PATH
export PATH=`pwd`/bin:$PATH

ROOTDIR=`pwd`/test

function setup {
    cd ${ROOTDIR}
}

function teardown {
    # nothing yet
    true
}

function MARK {
    echo
    echo "*** $1 ($2) ***"
    echo
}

# set variable if unset
TRAVIS_PULL_REQUEST=${TRAVIS_PULL_REQUEST:-false};

function build_app {
    cd $ROOTDIR/$1

    MARK 1 $1
    # test install from binary with fallback
    # run directly against node-pre-gyp
    node-pre-gyp clean
    node-pre-gyp install --fallback-to-build $2
    ls
    ls -l build/
    ls -l build/Release/
    npm test

    if [[ $TRAVIS_PULL_REQUEST == true ]] ; then
        MARK 2 $1
        echo "skipping publish"
        MARK 3 $1
        echo "skipping install from published binary"
    else
        MARK 2 $1
        # it works, so now publish
        node-pre-gyp package publish $2
        node-pre-gyp clean

        MARK 3 $1
        # now test installing via remote binary without fallback
        node-pre-gyp install $2
        npm test
    fi

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