#!/bin/bash

# put local copy of node-pre-gyp on NODE_PATH/PATH
export NODE_PATH=`pwd`/lib
export PATH=`pwd`/bin:$PATH

BASE=$(pwd)

source ~/.nvm/nvm.sh

function dotest {
    for i in {"0.8.28","0.10.32","0.11.13"}; do
        rm -rf build/
        node-pre-gyp clean
        npm install --build-from-source --target=$i $1
        node-pre-gyp package --target=$i
        nvm install $i
        nvm use $i
        node-pre-gyp testpackage
        node-pre-gyp clean
    done
}

cd ${BASE}/test/app1 && dotest
cd ${BASE}/test/app1 && dotest --custom_include_path=./include
cd ${BASE}/test/app3 && dotest
cd ${BASE}/test/app4 && dotest
