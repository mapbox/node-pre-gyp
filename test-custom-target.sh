#!/bin/bash

# put local copy of node-pre-gyp on NODE_PATH/PATH
export NODE_PATH=`pwd`/lib
export PATH=`pwd`/bin:$PATH

BASE=$(pwd)

cd ${BASE}/test/app1
source ~/.nvm/nvm.sh

for i in {"0.8.26","0.10.26","0.11.7","0.11.10","0.11.11"}; do
    rm -rf build/
    node-pre-gyp clean
    npm install --build-from-source --target=$i
    node-pre-gyp package --target=$i
    nvm install $i
    nvm use $i
    node-pre-gyp testpackage
done