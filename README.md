# node-pre-gyp

#### node-pre-gyp makes it easy to publish and install Node.js C++ addons from binaries

[![NPM](https://nodei.co/npm/node-pre-gyp.png)](https://nodei.co/npm/node-pre-gyp/)

[![Build Status](https://api.travis-ci.org/mapbox/node-pre-gyp.svg)](https://travis-ci.org/mapbox/node-pre-gyp)
[![Dependencies](https://david-dm.org/mapbox/node-pre-gyp.png)](https://david-dm.org/mapbox/node-pre-gyp)

`node-pre-gyp` stands between [npm](https://github.com/npm/npm) and [node-gyp](https://github.com/Tootallnate/node-gyp) and offers a cross-platform method of binary deployment.

### Features

 - A command line tool called `node-pre-gyp` that can install your package's c++ module from a binary.
 - A variety of developer targeted commands for packaging, testing, and publishing binaries.
 - A Javascript module that can dynamically require your installed binary: `require('node-pre-gyp').find`

For a hello world example of a module packaged with `node-pre-gyp` see <https://github.com/springmeyer/node-addon-example> and [the wiki ](https://github.com/mapbox/node-pre-gyp/wiki/Modules-using-node-pre-gyp) for real world examples.

## Credits

 - The module is modeled after [node-gyp](https://github.com/Tootallnate/node-gyp) by [@Tootallnate](https://github.com/Tootallnate)
 - Motivation for initial development came from [@ErisDS](https://github.com/ErisDS) and the [Ghost Project](https://github.com/TryGhost/Ghost).
 - Development is sponsored by [Mapbox](https://www.mapbox.com/)

## Depends

 - Node.js 0.10.x or 0.8.x

## Install

`node-pre-gyp` is designed to be installed as a local dependency of your Node.js C++ addon and accessed like:

    ./node_modules/.bin/node-pre-gyp --help

But you can also install it globally:

    npm install node-pre-gyp -g

## Usage

### Commands

View all possible commands:

    node-pre-gyp --help

- clean - Removes the entire folder containing the compiled .node module
- install - Attempts to install pre-built binary for module
- reinstall - Runs "clean" and "install" at once
- build - Attempts to compile the module by dispatching to node-gyp or nw-gyp
- rebuild - Runs "clean" and "build" at once
- package - Packs binary into tarball
- testpackage - Tests that the staged package is valid
- publish - Publishes pre-built binary
- unpublish - Unpublishes pre-built binary
- info - Fetches info on published binaries

You can also chain commands:

    node-pre-gyp clean build unpublish publish info

### Options

Options include:

 - `-C/--directory`: run the command in this directory
 - `--build-from-source`: build from source instead of using pre-built binary
 - `--runtime=node-webkit`: customize the runtime: `node` and `node-webkit` are the valid options
 - `--fallback-to-build`: fallback to building from source if pre-built binary is not available
 - `--target=0.10.25`: Pass the target node or node-webkit version to compile against
 - `--target_arch=ia32`: Pass the target arch (will override the host `arch`) 

Both `--build-from-source` and `--fallback-to-build` can be passed alone or they can provide values. You can pass `--fallback-to-build=false` to override the option as declared in package.json. In addition to being able to pass `--build-from-source` you can also pass `--build-from-source=myapp` where `myapp` is the name of your module.

For example: `npm install --build-from-source=myapp`. This is useful if:

 - `myapp` is referenced in the package.json of a larger app and therefore `myapp` is being installed as a dependent with `npm install`.
 - The larger app also depends on other modules installed with `node-pre-gyp`
 - You only want to trigger a source compile for `myapp` and the other modules.

### Configuring

This is a guide to configuring your module to use node-pre-gyp.

#### 1) Add new entries to your `package.json`

 - Add `node-pre-gyp` as a bundled dependency
 - Add a custom `install` script
 - Declare a `binary` object

This looks like:

```js
    "dependencies"  : {
      "node-pre-gyp": "0.5.x"
    },
    "bundledDependencies":["node-pre-gyp"],
    "scripts": {
        "install": "node-pre-gyp install --fallback-to-build",
    },
    "binary": {
        "module_name": "your_module",
        "module_path": "./lib/binding/",
        "host": "https://your_module.s3-us-west-1.amazonaws.com",
    }
```

For a full example see [node-addon-examples's package.json](https://github.com/springmeyer/node-addon-example/blob/2ff60a8ded7f042864ad21db00c3a5a06cf47075/package.json#L11-L22).

##### The `binary` object has three required properties

###### module_name

The name of your native node module. This value must:

 - Match the name passed to [the NODE_MODULE macro](http://nodejs.org/api/addons.html#addons_hello_world)
 - Must be a valid C variable name (e.g. it cannot contain `-`)
 - Should not include the `.node` extension.

###### module_path

The location your native module is placed after a build. This should be an empty directory without other javascript files. This entire directory will be packaged in the binary tarball. When installing from a remote package this directory will be overwritten with the contents of the tarball.

Note: This property supports variables based on [Versioning](#versioning).

###### host

A url to the remote location where you've published tarball binaries (must be `https` not `http`).

It is highly recommended that you use Amazon S3. The reasons are:

  - Various node-pre-gyp commands like `publish` and `info` only work with an S3 host.
  - S3 is a very solid hosting platform for distributing large files, even [Github recommends using it instead of github](https://help.github.com/articles/distributing-large-binaries).
  - We provide detail documentation for using [S3 hosting](#s3-hosting) with node-pre-gyp.

Why then not require S3? Because while some applications using node-pre-gyp need to distribute binaries as large as 20-30 MB, others might have very small binaries and might wish to store them in a github repo. This is not recommended, but if an author really wants to host in a non-s3 location then it should be possible.

##### The `binary` object has two optional properties

###### remote_path

It **is recommended** that you customize this property. This is an extra path to use for publishing and finding remote tarballs. The default value for `remote_path` is `""` meaning that if you do not provide it then all packages will be published at the base of the `host`. It is recommended to provide a value like `./{name}/v{version}` to help organize remote packages in the case that you choose to publish multiple node addons to the same `host`.

Note: This property supports variables based on [Versioning](#versioning).

###### package_name

It is **not recommended** to override this property unless you are also overriding the `remote_path`. This is the versioned name of the remote tarball containing the binary `.node` module and any supporting files you've placed inside the `module_path` directory. Unless you specify `package_name` in your `package.json` then it defaults to `{module_name}-v{version}-{node_abi}-{platform}-{arch}.tar.gz` which allows your binary to work across node versions, platforms, and architectures. If you are using `remote_path` that is also versioned by `./{module_name}/v{version}` then you could remove these variables from the `package_name` and just use: `{node_abi}-{platform}-{arch}.tar.gz`. Then your remote tarball will be looked up at, for example, `https://example.com/your-module/v0.1.0/node-v11-linux-x64.tar.gz`.

Note: This property supports variables based on [Versioning](#versioning).

#### 2) Add a new target to binding.gyp

`node-pre-gyp` calls out to `node-gyp` to compile the module and passes variables along like [module_name](#module_name) and [module_path](#module_path).

A new target must be added to `binding.gyp` that moves the compiled `.node` module from `./build/Release/module_name.node` into the directory specified by `module_path`.

Add a target like this at the end of your `targets` list:

```js
    {
      "target_name": "action_after_build",
      "type": "none",
      "dependencies": [ "<(module_name)" ],
      "copies": [
        {
          "files": [ "<(PRODUCT_DIR)/<(module_name).node" ],
          "destination": "<(module_path)"
        }
      ]
    }
```

For a full example see [node-addon-example's binding.gyp](https://github.com/springmeyer/node-addon-example/blob/2ff60a8ded7f042864ad21db00c3a5a06cf47075/binding.gyp).

#### 3) Dynamically require your `.node`

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
var path = require('path');
var binding_path = binary.find(path.resolve(path.join(__dirname,'./package.json')));
var binding = require(binding_path);
```

For a full example see [node-addon-example's index.js](https://github.com/springmeyer/node-addon-example/blob/2ff60a8ded7f042864ad21db00c3a5a06cf47075/index.js#L1-L4)

#### 4) Build and package your app

Now build your module from source:

    npm install --build-from-source

The `--build-from-source` tells `node-pre-gyp` to not look for a remote package and instead dispatch to node-gyp to build.

Now `node-pre-gyp` should now also be installed as a local dependency so the command line tool it offers can be found at `./node_modules/.bin/node-pre-gyp`.

#### 5) Test

Now `npm test` should work just as it did before.

#### 6) Publish the tarball

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

#### 7) Automate builds

Now you need to publish builds for all the platforms and node versions you wish to support. This is best automated. See [Travis Automation](#travis-automation) for how to auto-publish builds on OS X and Linux. On windows consider using a script [like this](https://github.com/mapbox/node-sqlite3/blob/master/scripts/build.bat) to quickly create and publish binaries and check out <https://appveyor.com>.

#### 8) You're done!

Now publish your package to the npm registry. Users will now be able to install your module from a binary. 

What will happen is this:

1. `npm install <your package>` will pull from the npm registry
2. npm will run the `install` script which will call out to `node-pre-gyp`
3. `node-pre-gyp` will fetch the binary `.node` module and unpack in the right place
4. Assuming that all worked, you are done

If a a binary was not available for a given platform and `--fallback-to-build` was used then `node-gyp rebuild` will be called to try to source compile the module.

## S3 Hosting

You can host wherever you choose but S3 is cheap, `node-pre-gyp publish` expects it, and S3 can be integrated well with [travis.ci](http://travis-ci.org) to automate builds for OS X and Ubuntu. Here is an approach to do this:

First, get setup locally and test the workflow:

#### 1) Create an S3 bucket

And have your **key** and **secret key** ready for writing to the bucket.

It is recommended to create a IAM user with a policy that only gives permissions to the specific bucket you plan to publish to. This can be done in the [IAM console](https://console.aws.amazon.com/iam/) by: 1) adding a new user, 2) choosing `Attach User Policy`, 3) Using the `Policy Generator`, 4) selecting `Amazon S3` for the service, 5) adding the actions: `DeleteObject`, `GetObject`, `GetObjectAcl`, `ListBucket`, `PutObject`, `PutObjectAcl`, 6) adding an ARN of `arn:aws:s3:::bucket/*` (replacing `bucket` with your bucket name), and finally 7) clicking `Add Statement` and saving the policy. It should generate a policy like:

```js
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Stmt1394587197000",
      "Effect": "Allow",
      "Action": [
        "s3:DeleteObject",
        "s3:GetObject",
        "s3:GetObjectAcl",
        "s3:ListBucket",
        "s3:PutObject",
        "s3:PutObjectAcl"
      ],
      "Resource": [
        "arn:aws:s3:::node-pre-gyp-tests/*"
      ]
    }
  ]
}
```

#### 2) Install node-pre-gyp

Either install it globally:

    npm install node-pre-gyp -g

Or put the local version on your PATH

    export PATH=`pwd`/node_modules/.bin/:$PATH

#### 3) Create `~/.node_pre_gyprc`

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

#### 4) Package and publish your build

Install the `aws-sdk`:

    npm install aws-sdk

Then publish:

    node-pre-gyp package publish

Note: if you hit an error like `Hostname/IP doesn't match certificate's altnames` it may mean that you need to provide the `region` option in your config.


## Travis Automation

Travis can push to S3 after a successful build and supports both:

 - Ubuntu Precise and OS X
 - Multiple Node.js versions

This enables you to cheaply auto-build and auto-publish binaries for (likely) the majority of your users.

For an example of doing this see [node-add-example's .travis.yml](https://github.com/springmeyer/node-addon-example/blob/2ff60a8ded7f042864ad21db00c3a5a06cf47075/.travis.yml).

Below is a guide to getting set up:

#### 1) Install the travis gem

    gem install travis

#### 2) Create secure `global` variables

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

#### 3) Hook up publishing

Just put `node-pre-gyp package publish` in your `.travis.yml` after `npm install`.

If you want binaries for OS X change your `.travis.yml` to use:

```yml
language: objective-c
```

Keep that change in a different git branch and sync that when you want binaries published. This little hack will hopefully become obsolete when [travis adds proper support for different operating systems](https://github.com/travis-ci/travis-ci/issues/216).

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

#### 4) Publish when you want

You might wish to publish binaries only on a specific commit. To do this you could borrow from the [travis.ci idea of commit keywords](http://about.travis-ci.org/docs/user/how-to-skip-a-build/) and add special handling for commit messages with `[publish binary]`:

    COMMIT_MESSAGE=$(git show -s --format=%B $TRAVIS_COMMIT | tr -d '\n')
    if test "${COMMIT_MESSAGE#*'[publish binary]'}" != "$COMMIT_MESSAGE"; then node-pre-gyp publish; fi;

Or you could automatically detect if the git branch is a tag:

    if [[ $TRAVIS_BRANCH == `git describe --tags --always HEAD` ]] ; then node-pre-gyp publish; fi

Remember this publishing is not the same as `npm publish`. We're just talking about the
binary module here and not your entire npm package. To automate the publishing of your entire package to npm on travis see http://about.travis-ci.org/docs/user/deployment/npm/

# Versioning

The `binary` properties of `module_path`, `remote_path`, and `package_name` support variable substitution. The strings are evaluated by `node-pre-gyp` depending on your system and any custom build flags you passed.

 - `configuration` - Either 'Release' or 'Debug' depending on if `--debug` is passed during the build.
 - `module_name` - the `binary.module_name` attribute from `package.json`.
 - `version` - the semver `version` value for your module from `package.json`.
 - `major`, `minor`, `patch`, and `prelease` match the individual semver values for your module's `version`
 - `node_abi`: The node C++ `ABI` number. This value is available in javascript as `process.versions.modules` as of [`>= v0.10.4 >= v0.11.7`](https://github.com/joyent/node/commit/ccabd4a6fa8a6eb79d29bc3bbe9fe2b6531c2d8e) and in C++ as the `NODE_MODULE_VERSION` define much earlier. For versions of Node before this was available we fallback to the V8 major and minor version.
 - `platform` matches node's `process.platform` like `linux`, `darwin`, and `win32`
 - `arch` matches node's `process.arch` like `x64` or `ia32` unless the user passes the `--target_arch` option to override.


The options are visible in the code at <https://github.com/mapbox/node-pre-gyp/blob/612b7bca2604508d881e1187614870ba19a7f0c5/lib/util/versioning.js#L114-L127>
