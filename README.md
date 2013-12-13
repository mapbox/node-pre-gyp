# node-pre-gyp

Node.js native add-on binary install tool.

 - Stands in front of node-gyp
 - Installs your module from a pre-compiled binary (which you are responsible for hosting)
 - If successfull avoids needing node-gyp to be invoked.
 - Falls back to calling `node-gyp rebuild` if binaries are not available

EXPERIMENTAL - not ready for widespread use.

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
        "install": "node-pre-gyp rebuild",
    }
```

Then users installing your module will get your binary, if available, instead of a source compile.


# Modules using `node-pre-gyp`:

 - [node-osmium](https://github.com/osmcode/node-osmium)
 - [node-sqlite3](https://github.com/mapbox/node-sqlite3)
