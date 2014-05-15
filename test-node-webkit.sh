#!/bin/bash

set -u

# put local copy of node-pre-gyp on NODE_PATH/PATH
export NODE_PATH=`pwd`/lib
export PATH=`pwd`/bin:$PATH

BASE=$(pwd)

export NODE_WEBKIT_VERSION="0.8.5"

# TODO - consider using https://github.com/shama/nodewebkit to install node-webkit
if [[ `uname -s` == 'Darwin' ]]; then
    if [[ ! -f node-webkit-v${NODE_WEBKIT_VERSION}-osx-ia32.zip ]]; then
        wget https://s3.amazonaws.com/node-webkit/v${NODE_WEBKIT_VERSION}/node-webkit-v${NODE_WEBKIT_VERSION}-osx-ia32.zip
    fi
    if [[ ! -d node-webkit.app ]]; then
        unzip node-webkit-v${NODE_WEBKIT_VERSION}-osx-ia32.zip
    fi
    export PATH=${BASE}/node-webkit.app/Contents/MacOS:${PATH}
else
    # assume 64 bit linux
    wget https://s3.amazonaws.com/node-webkit/v${NODE_WEBKIT_VERSION}/node-webkit-v${NODE_WEBKIT_VERSION}-linux-x64.tar.gz
    tar xf node-webkit-v${NODE_WEBKIT_VERSION}-linux-x64.tar.gz
    sudo apt-get install -y xvfb libasound2 libx11-6 libglib2.0-0 libgtk2.0-0 libatk1.0-0 libgdk-pixbuf2.0-0 libcairo2 libfreetype6 libfontconfig1 libxcomposite1 libasound2 libxdamage1 libxext6 libxfixes3 libnss3 libnspr4 libgconf-2-4 libexpat1 libdbus-1-3 libudev0
    # wget https://gist.githubusercontent.com/kez/2028715/raw/86f5084edb5cb0b9cdc1675ff310fad5e7579ee0/xvfb
    # sudo mv xvfb /etc/init.d/xvfb
    # sudo chmod 755 /etc/init.d/xvfb
    # sudo update-rc.d xvfb defaults
    # sudo /etc/init.d/xvfb start
    export DISPLAY=:99.0; sh -e /etc/init.d/xvfb start;
    export PATH=${BASE}/node-webkit-v0.8.5-linux-x64:${PATH}
fi

# install nw-gyp
npm install nw-gyp
export PATH=${BASE}/node_modules/.bin:${PATH}

cd test/app1
node-pre-gyp clean build --runtime=node-webkit --target=${NODE_WEBKIT_VERSION}
node-pre-gyp package --runtime=node-webkit --target=${NODE_WEBKIT_VERSION}
node-pre-gyp clean --runtime=node-webkit --target=${NODE_WEBKIT_VERSION}

# now test publishing and installing from remote
if [[ "${node_pre_gyp_accessKeyId:-false}" != false ]] || [[ -f $HOME/.node_pre_gyprc ]] ; then
    node-pre-gyp publish --runtime=node-webkit --target=${NODE_WEBKIT_VERSION}
    node-pre-gyp clean --runtime=node-webkit --target=${NODE_WEBKIT_VERSION}
    rm -rf build/
    rm -rf lib/binding/
    npm install --runtime=node-webkit --target=${NODE_WEBKIT_VERSION}
    # cleanup
    node-pre-gyp unpublish --runtime=node-webkit --target=${NODE_WEBKIT_VERSION}
fi
