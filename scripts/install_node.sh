# here we set up the node version on the fly based on the matrix value.
# This is done manually so that the build works the same on OS X
rm -rf ~/.nvm/ && git clone --depth 1 https://github.com/creationix/nvm.git ~/.nvm
NODE_VERSION=$1
source ~/.nvm/nvm.sh
nvm install ${NODE_VERSION}
nvm use ${NODE_VERSION}
node --version
npm --version
which node
