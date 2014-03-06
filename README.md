# node-pre-gyp

`node-pre-gyp` is a Node.js native add-on install tool.

[![NPM](https://nodei.co/npm/node-pre-gyp.png)](https://nodei.co/npm/node-pre-gyp/)

[![Build Status](https://secure.travis-ci.org/mapbox/node-pre-gyp.png)](https://travis-ci.org/mapbox/node-pre-gyp)
[![Dependencies](https://david-dm.org/mapbox/node-pre-gyp.png)](https://david-dm.org/mapbox/node-pre-gyp)

## Does this replace npm or node-gyp?

No: it plays nicely with them.

 - You still publish your package to the npm repository
 - You still create a `binding.gyp` to compile your module with `node-gyp`

What `node-pre-gyp` does is stand between `npm` and `node-gyp`. It offers two main things:

 - A command line tool called `node-pre-gyp` that can be called directly (or through npm) to install or package your module.
 - Javascript code that can be required to dynamically find your module: `require('node-pre-gyp').find`

## Who uses node-pre-gyp?

**Developers** of C++ modules can use `node-pre-gyp` to package and publish the modules `.node` binary before running `npm publish`.

**Users** can then `npm install` your module from a binary and `node-pre-gyp` does the work to make this seamless across platforms, node versions, and architectures.

## Modules using `node-pre-gyp`:

 - [node-sqlite3](https://github.com/mapbox/node-sqlite3)
 - [node-mapnik](https://github.com/mapnik/node-mapnik)
 - [node-osmium](https://github.com/osmcode/node-osmium)
 - [node-osrm](https://github.com/DennisOSRM/node-OSRM)

For more examples see the [test apps](test/).

## Usage

**1) Add node-pre-gyp as a bundled dependency in `package.json`**

```js
"dependencies"  : {
  "node-pre-gyp": "0.5.x",
},
"bundledDependencies":["node-pre-gyp"],
```


**2) Add a custom `install` script to `package.json`**

```js
    "scripts": {
        "install": "node-pre-gyp install --fallback-to-build",
    }
```

**3) Add a `binary` property to `package.json`**

A simple example is:

```js
"binary": {
    "module_name": "node_sqlite3",
    "module_path": "./lib/binding/",
    "host": "https://node-sqlite3.s3.amazonaws.com",
}
```

Required properties:

  - `module_name`: The name of your native node module. This must match [the name passed to `NODE_MODULE`](http://nodejs.org/api/addons.html#addons_hello_world) and should not include the `.node` extension.
  - `module_path`: The location your native module is placed after a build. This should be an empty directory without other javascript files. This is because everything in the directory will be packaged in the binary tarball and when unpack anything inside the directory will be overwritten with the contents of the tarball. **
  - `host`: A url to the remote location where you've published tarball binaries (must be `https` not `http`)

Optional properties:

  - `remote_path`:  It **is recommended** that you customize this property. This is an extra path to use for publishing and finding remote tarballs. The default value for `remote_path` is `""` meaning that if you do not provide it then all packages will be published at the base of the `host`. It is recommended to provide a value like `./{module_name}/v{version}` to help organize remote packages in the case that you choose to publish multiple node addons to the same `host`. **
  - `package_name`:  It is **not recommended** to override this property. This is the versioned name of the remote tarball containing the binary `.node` module and any supporting files you've placed inside the `module_path`. If you do not provide it in your `package.json` then it defaults to `{module_name}-v{version}-{node_abi}-{platform}-{arch}.tar.gz` which is a versioning string capable of supporting any remove lookup of your modules across all of its pubished versions and various node versions, platforms and architectures.  But if you only wish to support windows you could  could change it to `{module_name}-v{version}-{node_abi}-win32-{arch}.tar.gz`. See [Versioning](#versioning for details) about what each variable evaluates to. **

** Properties supporting versioning mean that they will be evaluated against known node-pre-gyp variables. See [Versioning](#versioning for details).

**4) Dynamically require your `.node`

Inside the main js file that requires your addon module you are likely currently doing:

```js
var binding = require('../build/Release/binding.node');
```

or:

```js
var bindings = require('./bindings')
```

Change those lines to:

```js
var binary = require('node-pre-gyp');
var path = require('path')
var binding_path = binary.find(path.resolve(path.join(__dirname,'./package.json')));
var binding = require(binding_path);
```

**5) Build and package your app**

Now build your module from source:

    npm install --build-from-source

The `--build-from-source` tells `node-pre-gyp` to not look for a remote package and instead dispatch to node-gyp to build.

Now `node-pre-gyp` should now also be installed as a local dependency so the command line tool it offers can be found at `./node_modules/.bin/node-pre-gyp`.

**6) Test **

Now `npm test` should work just as it did before.

**7) Publish the tarball**

Then package your app:

    ./node_modules/.bin/node-pre-gyp package

Once packaged, now you can publish:

    ./node_modules/.bin/node-pre-gyp publish

Currently the `publish` command pushes your binary to S3. This requires:

 - You have installed `aws-sdk` with `npm install aws-sdk`
 - You have created a bucket already.
 - The `host` points to an S3 http or https endpoint.
 - You have configured node-pre-gyp to read your S3 credentials (see [S3 hosting](#s3-hosting) for details).

You can also host your binaries elsewhere. To do this requires:

 - You manually publish the binary created by the `package` command to an `https` endpoint
 - Ensure that the `host` value points to your custom `https` endpoint.

**6) Automating builds**

Now you need to publish builds for all the platforms and node versions you wish to support. This is best automated. See [Travis Automation](#travis-automation) for how to auto-publish builds on OS X and Linux. On windows consider using a script [like this](https://github.com/mapbox/node-sqlite3/blob/master/scripts/build.bat) to quickly create and publish binaries.

**7) You're done!**

Now publish your package to the npm registry. Users will now be able to install your module from a binary. 

What will happen is this:

1. `npm install <your package>` will pull from the npm registry
2. npm will run the `install` script which will call out to `node-pre-gyp`
3. `node-pre-gyp` will fetch the binary `.node` module and unpack in the right place
4. Assuming that all worked, you are done

If a failure occurred and `--fallback-to-build` was used then `node-gyp rebuild` will be called to try to source compile the module.

## S3 Hosting

You can host wherever you choose but S3 is cheap, `node-pre-gyp publish` expects it, and S3 can be integrated well with [travis.ci](http://travis-ci.org) to automate builds for OS X and Ubuntu. Here is an approach to do this:

First, get setup locally and test the workflow:

**1) Create an S3 bucket**

And have your key and secret key ready for writing to the bucket.

**2) Install node-pre-gyp**

Either install it globally:

    npm install node-pre-gyp -g

Or put the local version on your PATH

    export PATH=`pwd`/node_modules/.bin/:$PATH

**3) Create an `~/.node_pre_gyprc`**

Or pass options in any way supported by [RC](https://github.com/dominictarr/rc#standards)

A `~/.node_pre_gyprc` looks like:

```js
{
    "accessKeyId": "xxx",
    "secretAccessKey": "xxx"
}
```

Another way is to use your environment:

    export node_pre_gyp_accessKeyId=xxx
    export node_pre_gyp_secretAccessKey=xxx

You may also need to specify the `region` if it is not explicit in the `host` value you use. The `bucket` can also be specified but it is optional because `node-pre-gyp` will detect it from the `host` value.

**4) Package and publish your build**

    node-pre-gyp package publish

Note: if you hit an error like `Hostname/IP doesn't match certificate's altnames` it may mean that you need to provide the `region` option in your config.

## Travis Automation

Travis can push to S3 after a successful build and supports both:

 - Ubuntu Precise and OS X
 - Multiple Node.js versions

This enables you to cheaply auto-build and auto-publish binaries for (likely) the majority of your users.

**1) Install the travis gem**

    gem install travis

**2) Create secure `global` variables**

Make sure you run this command from within the directory of your module.

Use `travis-encrypt` like:

    travis encrypt node_pre_gyp_accessKeyId=${node_pre_gyp_accessKeyId}
    travis encrypt node_pre_gyp_secretAccessKey=${node_pre_gyp_secretAccessKey}

Then put those values in your `.travis.yml` like:

```yaml
env:
  global:
    - secure: F+sEL/v56CzHqmCSSES4pEyC9NeQlkoR0Gs/ZuZxX1ytrj8SKtp3MKqBj7zhIclSdXBz4Ev966Da5ctmcTd410p0b240MV6BVOkLUtkjZJyErMBOkeb8n8yVfSoeMx8RiIhBmIvEn+rlQq+bSFis61/JkE9rxsjkGRZi14hHr4M=
    - secure: o2nkUQIiABD139XS6L8pxq3XO5gch27hvm/gOdV+dzNKc/s2KomVPWcOyXNxtJGhtecAkABzaW8KHDDi5QL1kNEFx6BxFVMLO8rjFPsMVaBG9Ks6JiDQkkmrGNcnVdxI/6EKTLHTH5WLsz8+J7caDBzvKbEfTux5EamEhxIWgrI=
```

More details on travis encryption at http://about.travis-ci.org/docs/user/encryption-keys/.

**3) Hook up publishing**

Just put `node-pre-gyp package publish` in your `.travis.yml` after `npm install`.

If you want binaries for OS X change your `.travis.yml` to use:

```yml
language: objective-c
```

Perhaps keep that change in a different git branch and sync that when you want binaries published.

Note: using `language: objective-c` instead of `language: nodejs` looses node.js specific travis sugar like a matrix for multiple node.js versions.

But you can replicate the lost behavior by replacing:

```yml
node_js:
  - "0.8"
  - "0.10"
```

With:

```yml
env:
  matrix:
    - export NODE_VERSION="0.8"
    - export NODE_VERSION="0.10"

before_install:
 - git clone https://github.com/creationix/nvm.git ./.nvm
 - source ./.nvm/nvm.sh
 - nvm install $NODE_VERSION
 - nvm use $NODE_VERSION
```

**4) Publish when you want**

You might wish to publish binaries only on a specific commit. To do this you could borrow from the [travis.ci idea of commit keywords](http://about.travis-ci.org/docs/user/how-to-skip-a-build/) and add special handling for commit messages with `[publish]`:

    COMMIT_MESSAGE=$(git show -s --format=%B $TRAVIS_COMMIT | tr -d '\n')
    if test "${COMMIT_MESSAGE#*'[publish]'}" != "$COMMIT_MESSAGE"; then node-pre-gyp publish; fi;

Or you could automatically detect if the git branch is a tag:

    if [[ $TRAVIS_BRANCH == `git describe --tags --always HEAD` ]] ; then node-pre-gyp publish; fi

Remember this publishing is not the same as `npm publish`. We're just talking about the
binary module here and not your entire npm package. To automate the publishing of your entire package to npm on travis see http://about.travis-ci.org/docs/user/deployment/npm/

### Commands

View all possible commands:

    node-pre-gyp --help


#### List published binaries

    node-pre-gyp info

#### Unpublish binaries

    node-pre-gyp unpublish

#### Clean install and build artifacts

    node-pre-gyp clean

#### Clean and install

    node-pre-gyp reinstall # runs "clean" and "install"

#### Chaining commands

    node-pre-gyp clean build unpublish publish info

### Options

Options include:

 - `-C/--directory`: run the command in this directory
 - `--build-from-source`: build from source instead of using pre-built binary
 - `--fallback-to-build`: fallback to building from source if pre-built binary is not available

Both `--build-from-source` and `--fallback-to-build` can be passed alone or they can provide values. So, in addition to being able to pass `--build-from-source` you can also pass `--build-from-source=myapp` where `myapp` is the name of your module.

For example: `npm install --build-from-source=myapp`. This is useful if:

 - `myapp` is referenced in the package.json of a larger app and therefore `myapp` is being installed as a dependent with `npm install`.
 - The larger app also depends on other modules installed with `node-pre-gyp`
 - You only want to trigger a source compile for `myapp` and the other modules.

# Versioning

The versioning template accepts these variables, which will get evaluated by `node-pre-gyp` depending on your system and any custom build flags you passed.

 - configuration folder - 'Release' or 'Debug'
 - `module_name` - the `name` attribute from `package.json`
 - `version` - the semver `version` value for your module
 - `major`, `minor`, `patch`, and `prelease` match the semver values for these properties
 - `node_abi`: The node versioning uses the C++ `ABI` number rather node's semver string. This value is available in javascript `process.versions.modules` as of [`>= v0.10.4 >= v0.11.7`](https://github.com/joyent/node/commit/ccabd4a6fa8a6eb79d29bc3bbe9fe2b6531c2d8e) and in C++ as the `NODE_MODULE_VERSION` define much earlier. Currently the `node-sqlite3` build scripts access this value only via `process.versions.modules` so for versions before `v0.10.4` the `v8` `MAJOR.MINOR` is used as a proxy.
 - `platform` matches node's `process.platform` like `linux`, `darwin`, and `win32`
 - `arch` matches node's `process.arch` like `x64` or `ia32` unless the user passes the `--target_arch` option to override.

Here is an example of usage (this goes in package.json):

```js
"template": "{configuration}/{module_name}-v{version}-{node_abi}-{platform}-{arch}.tar.gz"
```

The options are visible in the code here: https://github.com/springmeyer/node-pre-gyp/blob/master/lib/util/versioning.js#L62-L73