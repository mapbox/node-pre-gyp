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
        "install": "node-pre-gyp install",
    }
```

Then users installing your module will get your binary, if available, instead of a source compile.

## Using S3 for hosting binaries

The usage examples above and in the tests use Amazon S3 for hosting binaries. You can host wherever you choose but S3 is easy and can be integrated well with [travis.ci](http://travis-ci.org) to automate builds for OS X and Ubuntu. Here is an approach to do this:

First, get setup locally and test the workflow:

1. Create an S3 bucket and have your key and secret key ready

2. Install node-pre-gyp globally

    npm install node-pre-gyp -g

3. Create an `~/.node-pre-gyprc` file with `accessKeyId` and `secretAccessKey` values.

Or provide those options in any way compatible with [RC](https://github.com/dominictarr/rc#standards). You may also need to specify the `region` if it is not explicit in the `remote_uri` value you use. The `bucket` can also be specified but it is optional because `node-pre-gyp` will detect it from the `remote_uri` value.

4. Package and publish your build for a given platform

    node-pre-gyp package publish

Note: if you hit the error `Hostname/IP doesn't match certificate's altnames` it likely means that you need to provide the `region` option in your config.

# Modules using `node-pre-gyp`:

 - [node-osmium](https://github.com/osmcode/node-osmium)
 - [node-sqlite3](https://github.com/mapbox/node-sqlite3)
