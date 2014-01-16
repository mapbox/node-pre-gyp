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

    rm -rf ./lib/binding/*
    rm -rf ./build/*


    MARK "A" $1
    # test install from binary with fallback
    # run directly against node-pre-gyp
    node-pre-gyp clean
    node-pre-gyp install --fallback-to-build $2
    npm test

    if [[ $TRAVIS_PULL_REQUEST == true ]] ; then
        MARK "B" $1
        echo "skipping publish"
        MARK "C" $1
        echo "skipping install from published binary"
    else
        MARK "D" $1
        # it works, so now publish
        node-pre-gyp package publish $2
        node-pre-gyp testpackage --overwrite

        MARK "E" $1
        # now test installing via remote binary without fallback
        node-pre-gyp clean
        npm install --fallback-to-build=false $2
        npm test
    fi

    MARK "F" $1
    # sabotage binaries and make sure they are rebuilt
    for i in $(find . -name '*.node') ; do
        echo 'bogus' > $i;
    done
    npm install $2
    npm test

    # cleanup
    node-pre-gyp clean
    rm -rf {build,node_modules}
    rm -rf lib/binding/
    cd ${ROOTDIR}
}

setup
# simpliest, least config node c++ addon possible
build_app "app1" ""
# app with more custom organization and needing a variable passed for custom include path
build_app "app2" "--custom_include_path=`pwd`/app2/include"
# app that depends on an external static library
build_app "app3" ""
# app that depends on an external shared library
build_app "app4" ""
teardown