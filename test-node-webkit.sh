#!/bin/bash

set -e -u

# TODO - consider using https://github.com/shama/nodewebkit to install node-webkit
if [[ `uname -s` == 'Darwin' ]]; then
    if [[ ! -f node-webkit-v0.8.4-osx-ia32.zip ]]; then
        wget https://s3.amazonaws.com/node-webkit/v0.8.4/node-webkit-v0.8.4-osx-ia32.zip
    fi
    if [[ ! -d node-webkit.app ]]; then
        unzip node-webkit-v0.8.4-osx-ia32.zip
    fi
    export PATH=$(pwd)/node-webkit.app/Contents/MacOS/:${PATH}
    cd test/app1
    rm -rf build/
    rm -rf lib/binding/
    node-pre-gyp clean build --runtime=node-webkit --target=0.8.4
    node-pre-gyp package --runtime=node-webkit
    node-pre-gyp clean
    rm -rf lib/binding/
    node-pre-gyp testpackage --runtime=node-webkit 2>/dev/null 1>/dev/null &
    # now test installing from remote
    node-pre-gyp unpublish publish --runtime=node-webkit
    node-pre-gyp clean
    rm -rf build/
    rm -rf lib/binding/
    npm install --runtime=node-webkit
fi