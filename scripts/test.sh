#!/bin/bash

set -e -u
#set -x

# put local copy of node-pre-gyp on NODE_PATH/PATH
export NODE_PATH=`pwd`/lib
export PATH=`pwd`/bin:$PATH

BASE=$(pwd)

function setup {
    if [[ `node -v` =~ 'v0.10' ]] && [[ ! -d "./node_modules/nw-gyp" ]]; then
        npm ls
    fi
    cd ${BASE}
}

function teardown {
    cd ${BASE}
}

function MARK {
    echo
    echo "*** $1 ($2) ***"
    echo
}

function build_app {
    WD=$( cd $BASE/test/$1 && pwd )

    OPT_ARG=""
    if [[ "${2:-false}" != false ]]; then
        OPT_ARG=$2
    fi

    rm -rf ${WD}/lib/binding/*
    rm -rf ${WD}/build/*

    MARK "A" $1
    # test install from binary with fallback
    # run directly against node-pre-gyp
    node-pre-gyp clean -C $WD
    if [[ $1  == "app2" ]]; then
        node-pre-gyp -C $WD install --fallback-to-build --custom_include_path=$WD/include $OPT_ARG
    else
        node-pre-gyp -C $WD install --fallback-to-build $OPT_ARG
    fi

    # ensure the binary exists in the same spot the reveal command thinks it is
    MODULE_PATH_DIR=$(node-pre-gyp -C $WD reveal module_path $OPT_ARG)
    if [[ ! -d ${MODULE_PATH_DIR} ]]; then
        echo "failed to locate expected module_path directory: $MODULE_PATH_DIR"
        false
    fi

    MODULE_FILE=$(node-pre-gyp -C $WD reveal module $OPT_ARG)
    if [[ ! -f ${MODULE_FILE} ]]; then
        echo "failed to locate expected module file: $MODULE_FILE"
        false
    fi

    # run npm commands from correct directory
    cd $WD && npm test && cd $BASE

    if [[ "${AWS_ACCESS_KEY_ID:-false}" != false ]] || [[ "${node_pre_gyp_accessKeyId:-false}" != false ]] || [[ -f $HOME/.node_pre_gyprc ]] ; then
        MARK "D" $1
        # it works, so now publish
        node-pre-gyp -C $WD package testpackage unpublish publish $OPT_ARG

        # now test listing published binaries
        CURRENT_ARCH=$(node -e "console.log(process.arch)")
        CURRENT_PLATFORM=$(node -e "console.log(process.platform)")
        BINARIES=$(node-pre-gyp -C $WD info --loglevel warn $OPT_ARG)
        # now ensure that both the current arch and platform
        # show up in the published listing
        if test "${BINARIES#*$CURRENT_PLATFORM}" == "$BINARIES"; then
            echo "failed to detect published binary for platform $CURRENT_PLATFORM ($BINARIES)"
            false
        else
            echo "detected published $CURRENT_PLATFORM"
        fi
        if test "${BINARIES#*$CURRENT_ARCH}" == "$BINARIES"; then
            echo "failed to detect published binary for arch $CURRENT_ARCH ($BINARIES)"
            false
        else
            echo "detected published $CURRENT_ARCH"
        fi

        MARK "E" $1
        # actually move into correct working
        # directory now so we don't need -C
        cd $WD
        # now test installing via remote binary without fallback
        node-pre-gyp clean $OPT_ARG
        npm install --fallback-to-build=false $OPT_ARG
        npm test
        # for app1 also test in debug
        if [[ $1  == "app2" ]]; then
            node-pre-gyp clean $OPT_ARG
        fi
    else
        MARK "B" $1
        echo "skipping publish"
        MARK "C" $1
        echo "skipping install from published binary"
    fi

    MARK "F" $1
    # actually move into correct working
    # directory now so we don't need -C
    cd $WD
    # sabotage binaries and make sure they are rebuilt
    for i in $(find . -name '*.node') ; do
        echo 'bogus' > $i;
    done
    if [[ $1  == "app2" ]]; then
        npm install --custom_include_path=$WD/include $OPT_ARG
    else
        npm install $OPT_ARG
    fi

    MARK "G" $1
    npm test

    # cleanup
    if [[ "${AWS_ACCESS_KEY_ID:-false}" != false ]] || [[ "${node_pre_gyp_accessKeyId:-false}" != false ]] || [[ -f $HOME/.node_pre_gyprc ]] ; then
        node-pre-gyp unpublish $OPT_ARG
    fi
    node-pre-gyp clean $OPT_ARG
    rm -rf $WD/{build,node_modules}
    rm -rf $WD/lib/binding/
    cd ${BASE}
}

setup
# simpliest, least config node c++ addon possible
build_app "app1"
# app with more custom organization and needing a variable passed for custom include path
build_app "app2"
# build app2 in debug mode
build_app "app2" "--debug"
# app that depends on an external static library
build_app "app3"
# app that depends on an external shared library
build_app "app4"
# disabled for now until node v0.11.x churn is over
#cd ${BASE}/test/app5 && npm cache clean || true;rm -rf node_modules/;npm install
#cd ${BASE}/test/app6 && npm cache clean || true;rm -rf node_modules/;npm install
teardown
