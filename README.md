# node-pre-gyp

[![Build Status](https://secure.travis-ci.org/springmeyer/node-pre-gyp.png)](https://travis-ci.org/springmeyer/node-pre-gyp)

`node-pre-gyp` is a Node.js native add-on install tool.

## Does this replace npm or node-gyp?

No: it plays nicely with them.

 - You still publish your package to the npm repository
 - You still create a `binding.gyp` to compile your module with `node-gyp`

What node-pre-gyp does is stand between `npm` and `node-gyp`.

## Who uses node-pre-gyp?

You: the developers of a C++ module. You use `node-pre-gyp` to package and and publish the binary `.node` right before you `npm publish` a new version.

Your users: Once your package uses `node-pre-gyp` then users can `npm install` your module without a C++ compiler and `node-pre-gyp` handles the complexity behind the scenes.

## Why use node-pre-gyp?

Successful deployment of your module using `node-pre-gyp` will mean:

 - Users can be blissfully unaware that your module is written in C++
 - During development you will run `node-pre-gyp build` instead of `npm install`
 - You will take on the responsibility for providing binaries to your users

## Modules using `node-pre-gyp`:

 - [node-sqlite3](https://github.com/mapbox/node-sqlite3)
 - [node-mapnik](https://github.com/mapnik/node-mapnik)
 - [node-osmium](https://github.com/osmcode/node-osmium)

For more examples see also the [test apps](test/).

## Usage

**1) You add a `binary` property to your modules `package.json`**

It must provide these properties:

  - `module_name`: The name of your native node module.
  - `module_path`: The location your native module is placed after a build (commonly `build/Release/`)
  - `remote_uri`: A url to the remote location where you've published tarball binaries
  - `template`: A string describing the tarball versioning scheme for your binaries

And example from `node-osmium` looks like:

```js
    "binary": {
        "module_name": "osmium",
        "module_path": "./lib",
        "remote_uri": "http://node-osmium.s3.amazonaws.com",
        "template": "{module_name}-v{major}.{minor}.{patch}-{node_abi}-{platform}-{arch}.tar.gz"
    },
```

**2) Build and package your app**

```sh
node-pre-gyp build package
```

**3) Publish the tarball**

Post the resulting tarball (in the `build/stage/` directory) to your `remote-uri`.

 - Learn how to [host on S3](#s3-hosting).
 - See [Travis Packaging](#travis-packaging) for recipes for automating publishing builds on OS X and Linux.

**4) Add a custom `install` script**

```js
    "scripts": {
        "install": "node-pre-gyp install --fallback-to-build",
    }
```

Then users installing your module will get your binary, if available, instead of the default behavior of `npm` calling `node-gyp rebuild` right away. The `--fallback-to-build` option is recommended: if no binary is available for a given users platform then a source compile (`node-pre-gyp rebuild`) will be attempted.

**5) You're done!**

Now you are done. Publish your package to the npm registry. Users will now be able to install your module from a binary. 

What will happen is this:

1. `npm install <your package>` will pull from the npm registry
2. npm will run the `install` script which will call out to `node-pre-gyp`
3. `node-pre-gyp` will fetch the binary `.node` module and place it in the right place
4. Assuming that all worked, you are done

If a failure occurred and `--fallback-to-build` was used then `node-gyp rebuild` will be called.

## S3 Hosting

The usage examples above and in the tests use Amazon S3 for hosting binaries. You can host wherever you choose but S3 is cheap, `node-pre-gyp publish` expects it, and S3 can be integrated well with [travis.ci](http://travis-ci.org) to automate builds for OS X and Ubuntu. Here is an approach to do this:

First, get setup locally and test the workflow:

**1) Create an S3 bucket and have your key and secret key ready**

**2) Install node-pre-gyp**

Either install it globally:

    npm install node-pre-gyp -g

Or put the local version on your PATH

    export PATH=`pwd`/node_modules/.bin/:$PATH

**3) Create an `~/.node_pre_gyprc`**

Or pass options in any way supported by [RC](https://github.com/dominictarr/rc#standards)

`~/.node_pre_gyprc` looks like:

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

Do this for every platform and node version you wish to support:

    node-pre-gyp package publish

Note: if you hit the error `Hostname/IP doesn't match certificate's altnames` it likely means that you need to provide the `region` option in your config.

## Travis Packaging

Travis can push to S3 after a successful build and supports both:

 - Ubuntu precise and OS X
 - multiple Node.js versions

This enables you to cheaply auto-build and auto-publish binaries for (likely) the majority of users.

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

You can replace:

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

    if test "${TRAVIS_COMMIT#*[publish]}" != "$TRAVIS_COMMIT"; then
       node-pre-gyp publish
    fi

Or you could automatically detect if the git branch is a tag:

    if [[ $TRAVIS_BRANCH == `git describe --tags --always HEAD` ]] ; then
       node-pre-gyp publish
    fi

Remember this publishing is not the same as `npm publish`. We're just talking about the
binary module here and not your entire npm package. To automate the publishing of your entire package to npm on travis see http://about.travis-ci.org/docs/user/deployment/npm/

### Commands

`node-pre-gyp` supports many of the same commands as `node-gyp` with some critical differences

#### Clean install and build artifacts

    node-pre-gyp clean

#### Clean and install

    node-pre-gyp reinstall # runs "clean" and "install"

#### Build the module from source instead of installing from pre-built binary:

    node-pre-gyp install --build-from-source

This is basically the equivalent to calling `node-gyp rebuild` which is what `npm install` call if you don't override (like recommended above) the `scripts/install` target in `package.json`.

### Options

Options include:

 - `--build-from-source`
 - `--fallback-to-build`

Both of these options can be passed as they are or can provide values. So, in addition to being able to pass `--build-from-source` you can also pass `--build-from-source=myapp` where `myapp` is the name of your module.

For example: `npm install --build-from-source=myapp`. This is useful if:

 - `myapp` is referenced in the package.json of a larger app and therefore `myapp` is being installed as a dependent with `npm install`.
 - The larger app also depends on other modules installed with `node-pre-gyp`
 - You only want to trigger a source compile for `myapp` and the other modules.
