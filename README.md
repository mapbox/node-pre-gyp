# node-pre-gyp

Node.js native add-on binary install tool.

 - Stands in front of node-gyp
 - Installs your module from a pre-compiled binary (which you are responsible for hosting)
 - If successfull avoids needing node-gyp to be invoked.
 - Falls back to calling `node-gyp rebuild` if binaries are not available

EXPERIMENTAL - not ready for widespread use.

[![Build Status](https://secure.travis-ci.org/springmeyer/node-pre-gyp.png)](https://travis-ci.org/springmeyer/node-pre-gyp)

# Design

You add a `binary` property to your `package.json` which lists:

  - `module_name`: The name of your native node module.
  - `module_path`: The location your native module is placed after a build (commonly `build/Release/`)
  - `remote_uri`: A url to the remote location where tarball binaries are available
  - `template`: A versioning string which describes the tarball versioning scheme for your binaries

And example from `node-osmium` looks like:

```js
    "binary": {
        "module_name": "osmium",
        "module_path": "./lib",
        "remote_uri": "http://node-osmium.s3.amazonaws.com",
        "template": "{module_name}-v{major}.{minor}.{patch}-{node_abi}-{platform}-{arch}.tar.gz"
    },
```

Then to package a binary you do:

```js
node-pre-gyp package
```

Then post the resulting tarball (in the `stage/` directory) to your remote location.

Finally you add a custom `install` script:

```js
    "scripts": {
        "install": "node-pre-gyp install --fallback-to-build",
    }
```

Then users installing your module will get your binary, if available. The `--fallback-to-build` option is recommended and means that if no binary is available for a given users platform then a source compile(`node-pre-gyp rebuild`) will be attempted.

Simply pass `node-pre-gyp install` if you don't want users to be able to install your module unless binaries are available (disables source compile build fallback).

### Command details

#### Clean install and build artifacts

    node-pre-gyp clean

#### Clean and install

    node-pre-gyp reinstall

#### Build the module from source instead of installing from pre-built binary:

    node-pre-gyp install --build-from-source

This is basically the equivalent to calling `node-gyp rebuild` which is what `npm install` displatches to if you don't override (like recommended above) the `scripts/install` target in `package.json`.

### Options

Options include:

 - `--build-from-source`
 - `--fallback-to-build`

Both of these options can be passed as they are or can provide values. So, in addition to being able to pass `--build-from-source` you can also pass `--build-from-source=myapp` where `myapp` is the name of your module.

For example: `npm install --build-from-source=myapp`. This is useful if:

 - `myapp` is referenced in the package.json of a larger app and therefore `myapp` is being installed as a dependent with `npm install`.
 - The larger app also depends on other modules installed with `node-pre-gyp`
 - You only want to trigger a source compile for `myapp` and the other modules.


## Using S3 for hosting binaries

The usage examples above and in the tests use Amazon S3 for hosting binaries. You can host wherever you choose but S3 is easy and can be integrated well with [travis.ci](http://travis-ci.org) to automate builds for OS X and Ubuntu. Here is an approach to do this:

First, get setup locally and test the workflow:

1. Create an S3 bucket and have your key and secret key ready

2. Install node-pre-gyp globally

    npm install node-pre-gyp -g

3. Create an `~/.node_pre_gyprc` file with `accessKeyId` and `secretAccessKey` values.

Or provide those options in any way compatible with [RC](https://github.com/dominictarr/rc#standards). Another way that works well with travis is to set the variables in the environment like:

    export node_pre_gyp_accessKeyId=<key>
    export node_pre_gyp_secretAccessKey=<key>

You may also need to specify the `region` if it is not explicit in the `remote_uri` value you use. The `bucket` can also be specified but it is optional because `node-pre-gyp` will detect it from the `remote_uri` value.

4. Package and publish your build for a given platform

    node-pre-gyp package publish

Note: if you hit the error `Hostname/IP doesn't match certificate's altnames` it likely means that you need to provide the `region` option in your config.

## Using Travis for automatically building your bindings

Travis can push to S3 after a successful build and supports both ubuntu precise and OS X, enabling you to cheaply build binaries for you module every commit or each tag.

1. Install the travis gem:

    gem install travis

2. Create secure `global` variables.

Use `travis-encrypt` like:

    travis encrypt node_pre_gyp_accessKeyId=<key>
    travis encrypt node_pre_gyp_secretAccessKey=<key>

Then put those values in your `.travis.yml` like:

```yaml
env:
  global:
    - secure: F+sEL/v56CzHqmCSSES4pEyC9NeQlkoR0Gs/ZuZxX1ytrj8SKtp3MKqBj7zhIclSdXBz4Ev966Da5ctmcTd410p0b240MV6BVOkLUtkjZJyErMBOkeb8n8yVfSoeMx8RiIhBmIvEn+rlQq+bSFis61/JkE9rxsjkGRZi14hHr4M=
    - secure: o2nkUQIiABD139XS6L8pxq3XO5gch27hvm/gOdV+dzNKc/s2KomVPWcOyXNxtJGhtecAkABzaW8KHDDi5QL1kNEFx6BxFVMLO8rjFPsMVaBG9Ks6JiDQkkmrGNcnVdxI/6EKTLHTH5WLsz8+J7caDBzvKbEfTux5EamEhxIWgrI=
```

More details on travis encryption at http://about.travis-ci.org/docs/user/encryption-keys/.

3. Hook up publishing

Just put `node-pre-gyp package publish` in your `.travis.yml` after `npm install`.

If you want binaries for OS X change your `.travis.yml` to use:

```yml
language: objective-c
```

Perhaps keep that change in a different git branch and sync that when you want binaries published.

4. Publish just when you want

You might wish to publish binaries only on a specific commit. To do this you could borrow from the [travis.ci idea of commit keywords](http://about.travis-ci.org/docs/user/how-to-skip-a-build/) and add special handling for commit messages with `[publish]`:

    if echo $TRAVIS_COMMIT | grep -q "publish"; then
       node-pre-gyp publish
    fi

Or you could automatically detect if the git branch is a tag and publish:

    IS_TAG=$(git describe --exact-match --tags HEAD || true)
    if [ $IS_TAG ];
       node-pre-gyp publish
    fi

Remember this publishing is not the same as `npm publish`. We're just talking about the
binary module here and not your entire npm package. To automate the publishing of your entire package to npm on travis see http://about.travis-ci.org/docs/user/deployment/npm/

# Modules using `node-pre-gyp`:

 - [node-osmium](https://github.com/osmcode/node-osmium)
 - [node-sqlite3](https://github.com/mapbox/node-sqlite3)
