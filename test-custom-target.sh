#!/bin/bash

set -e -u

if [[ `uname -s` == 'Darwin' ]]; then
    export PATH=`pwd`/bin:$PATH
    BASE=`pwd`
    cd ${BASE}/test/app1
    rm -rf build/
    rm -rf lib/binding/
    source ~/.nvm/nvm.sh
    for i in $(ls ~/.node-gyp/); do
        npm install --build-from-source --target=$i
        node-pre-gyp package --target=$i
        nvm use $i
        node-pre-gyp testpackage --overwrite
        /Users/dane/.nvm/v$i/bin/node ../../bin/node-pre-gyp testpackage --overwrite
    done
fi