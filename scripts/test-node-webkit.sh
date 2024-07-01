#!/bin/bash

nw_version=${1:-"0.50.2"}

set -eu
set -o pipefail

# put local copy of node-pre-gyp on NODE_PATH/PATH
export NODE_PATH=`pwd`/lib
export PATH=`pwd`/bin:$PATH

BASE=$(pwd)

export NODE_WEBKIT_VERSION="${nw_version}"
export NW_INSTALL_URL="https://dl.nwjs.io"

if [[ `uname -s` == 'Darwin' ]]; then
    if [[ ! -f nwjs-v${NODE_WEBKIT_VERSION}-osx-x64.zip ]]; then
        wget -q ${NW_INSTALL_URL}/v${NODE_WEBKIT_VERSION}/nwjs-v${NODE_WEBKIT_VERSION}-osx-x64.zip
    fi
    if [[ ! -d nwjs-v${NODE_WEBKIT_VERSION}-osx-x64/nwjs.app ]]; then
        unzip nwjs-v${NODE_WEBKIT_VERSION}-osx-x64.zip
    fi
    export PATH=${BASE}/nwjs-v${NODE_WEBKIT_VERSION}-osx-x64/nwjs.app/Contents/MacOS:${PATH}
else
    wget -q ${NW_INSTALL_URL}/v${NODE_WEBKIT_VERSION}/nwjs-v${NODE_WEBKIT_VERSION}-linux-x64.tar.gz
    tar xf nwjs-v${NODE_WEBKIT_VERSION}-linux-x64.tar.gz
    export PATH=${BASE}/nwjs-v${NODE_WEBKIT_VERSION}-linux-x64:${PATH}
fi

# install nw-gyp
npm install nw-gyp
export PATH=${BASE}/node_modules/.bin:${PATH}

cd test/app1
node-pre-gyp rebuild --runtime=node-webkit --target=${NODE_WEBKIT_VERSION}
node-pre-gyp package --runtime=node-webkit --target=${NODE_WEBKIT_VERSION}
node-pre-gyp clean --runtime=node-webkit --target=${NODE_WEBKIT_VERSION}

# now test publishing and installing from remote
if [[ "${node_pre_gyp_accessKeyId:-false}" != false ]] || [[ -f $HOME/.node_pre_gyprc ]] ; then
    node-pre-gyp unpublish publish --runtime=node-webkit --target=${NODE_WEBKIT_VERSION}
    node-pre-gyp clean --runtime=node-webkit --target=${NODE_WEBKIT_VERSION}
    rm -rf build/
    rm -rf lib/binding/
    npm install --runtime=node-webkit --target=${NODE_WEBKIT_VERSION}
    # cleanup
    node-pre-gyp unpublish --runtime=node-webkit --target=${NODE_WEBKIT_VERSION}
fi
