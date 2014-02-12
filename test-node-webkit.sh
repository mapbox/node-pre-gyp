

if [[ `uname -s` == 'Darwin' ]]; then
    if [[ ! -f node-webkit-v0.8.4-osx-ia32.zip ]]; then
        wget https://s3.amazonaws.com/node-webkit/v0.8.4/node-webkit-v0.8.4-osx-ia32.zip
    fi
    if [[ ! -d node-webkit.app ]]; then
        unzip node-webkit-v0.8.4-osx-ia32.zip
    fi
    export PATH=$(pwd)/node-webkit.app/Contents/MacOS/:${PATH}
    cd test/app1
    node-pre-gyp clean build --runtime=node-webkit --target=0.8.4
    node-pre-gyp package --runtime=node-webkit
    node-pre-gyp clean
    killall node-webkit 2>/dev/null
    node-pre-gyp testpackage --runtime=node-webkit --overwrite  2>/dev/null 1>/dev/null &
    pid=$!
    sleep 5
    kill $pid
    if [ $? != 0 ]; then
      echo "Unable to start app"
    else
      echo "app started just fine"
    fi
    killall node-webkit 2>/dev/null
#    ${NW} index.js
fi