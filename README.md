# node-pre-gyp

[![Build Status](https://secure.travis-ci.org/springmeyer/node-pre-gyp.png)](https://travis-ci.org/springmeyer/node-pre-gyp)

`node-pre-gyp` is a Node.js native add-on install tool.

## Does this replace npm or node-gyp?

No: it plays nicely with them.

 - You still publish your package to the npm repository
 - You still create a `binding.gyp` to compile your module with `node-gyp`

What `node-pre-gyp` does is stand between `npm` and `node-gyp`.

## Who uses node-pre-gyp?

**Developers** of C++ modules can use `node-pre-gyp` to package and publish the binary `.node` before running `npm publish`.

**Users** can then `npm install` your module from a binary and `node-pre-gyp` does the work to make this seamless.

## Modules using `node-pre-gyp`:

 - [node-sqlite3](https://github.com/mapbox/node-sqlite3)
 - [node-mapnik](https://github.com/mapnik/node-mapnik)
 - [node-osmium](https://github.com/osmcode/node-osmium)
 - [node-osrm](https://github.com/DennisOSRM/node-OSRM)

For more examples see the [test apps](test/).

## Usage


**1) Add a custom `install` script to `package.json`**

```js
    "scripts": {
        "install": "node-pre-gyp install --fallback-to-build",
    }
```


**2) Add a `binary` property to `package.json`**

It must provide these properties:

  - `module_name`: The name of your native node module.
  - `module_path`: The location your native module is placed after a build. This should be an empty directory without other javascript files.
  - `remote_uri`: A url to the remote location where you've published tarball binaries
  - `template`: A string describing the tarball versioning scheme for your binaries

And example from `node-sqlite3` looks like:

```js
    "binary": {
        "module_name": "node_sqlite3",
        "module_path": "./lib/binding/",
        "remote_uri": "http://node-sqlite3.s3.amazonaws.com",
        "template": "{configuration}/{module_name}-v{version}-{node_abi}-{platform}-{arch}.tar.gz"
    },
```

**3) Build and package your app**

```sh
node-pre-gyp build package
```

**4) Publish the tarball**

```sh
node-pre-gyp publish
```

Currently the `publish` command pushes your binary to S3. This requires:

 - You have created a bucket already.
 - The `remote-uri` points to an S3 http or https endpoint.
 - You have configured node-pre-gyp to read your S3 credentials (see [S3 hosting](#s3-hosting) for details).

You can also host your binaries elsewhere. To do this requires:

 - You manually publish the binary created by the `package` command.
 - The package is available as a tarball in the `build/stage/` directory.
 - You provide a remote location and point the `remote_uri` value to it.

**5) Automating builds**

Now you need to publish builds for all the platforms and node versions you wish to support. This is best automated. See [Travis Automation](#travis-automation) for how to auto-publish builds on OS X and Linux. On windows consider using a script [like this](https://github.com/mapbox/node-sqlite3/blob/master/scripts/build.bat) to quickly create and publish binaries.

**6) You're done!**

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

You may also need to specify the `region` if it is not explicit in the `remote_uri` value you use. The `bucket` can also be specified but it is optional because `node-pre-gyp` will detect it from the `remote_uri` value.

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
