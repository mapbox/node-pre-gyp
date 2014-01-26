#!/bin/bash

set -e -u
#set -x

# put npm's copy of node-gyp on the PATH
export PATH=`npm explore npm -g -- pwd`/bin/node-gyp-bin:$PATH
export PATH=`pwd`/bin:$PATH
BASE=`pwd`

function setup {
    # nothing yet
    true
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

function build_app {
    WD=$( cd $BASE/test/$1 && pwd )

    rm -rf ${WD}/lib/binding/*
    rm -rf ${WD}/build/*

    MARK "A" $1
    # test install from binary with fallback
    # run directly against node-pre-gyp
    node-pre-gyp clean -C $WD
    if [[ $1  == "app2" ]]; then
        node-pre-gyp -C $WD install --fallback-to-build --custom_include_path=$WD/include
    else
        node-pre-gyp -C $WD install --fallback-to-build
    fi
    # run npm commands from correct directory
    cd $WD && npm test && cd $BASE

    if [[ $node_pre_gyp_accessKeyId ]] || [[ -f $HOME/.node_pre_gyprc ]] ; then
        MARK "D" $1
        # it works, so now publish
        node-pre-gyp -C $WD unpublish package publish
        node-pre-gyp -C $WD testpackage --overwrite
        node-pre-gyp -C $WD unpublish
        node-pre-gyp -C $WD publish

        # now test listing published binaries
        CURRENT_ARCH=$(node -e "console.log(process.arch)")
        CURRENT_PLATFORM=$(node -e "console.log(process.platform)")
        BINARIES=$(node-pre-gyp -C $WD info --loglevel warn)
        # now ensure that both the current arch and platform
        # show up in the published listing
        if test "${BINARIES#*$CURRENT_PLATFORM}" == "$BINARIES"; then
            echo "failed to detect published binary for $CURRENT_PLATFORM"
            false
        else
            echo "detected published $CURRENT_PLATFORM"
        fi
        if test "${BINARIES#*$CURRENT_ARCH}" == "$BINARIES"; then
            echo "failed to detect published binary for $CURRENT_ARCH"
            false
        else
            echo "detected published $CURRENT_ARCH"
        fi

        MARK "E" $1
        # actually move into correct working
        # directory now so we don't need -C
        cd $WD
        # now test installing via remote binary without fallback
        node-pre-gyp -C $WD clean
        npm install --fallback-to-build=false
        npm test
    else
        MARK "B" $1
        echo "skipping publish"
        MARK "C" $1
        echo "skipping install from published binary"
    fi

    MARK "F" $1
    # sabotage binaries and make sure they are rebuilt
    for i in $(find . -name '*.node') ; do
        echo 'bogus' > $i;
    done
    if [[ $1  == "app2" ]]; then
        npm install --custom_include_path=$WD/include
    else
        npm install
    fi
    npm test

    # cleanup
    node-pre-gyp clean
    rm -rf $WD/{build,node_modules}
    rm -rf $WD/lib/binding/
    cd ${BASE}
}

setup
# simpliest, least config node c++ addon possible
build_app "app1"
# app with more custom organization and needing a variable passed for custom include path
build_app "app2"
# app that depends on an external static library
build_app "app3"
# app that depends on an external shared library
build_app "app4"
teardown