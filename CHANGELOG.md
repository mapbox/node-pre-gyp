# node-pre-gyp changelog

## 0.5.19

 - Updated to know about more node-webkit releases

## 0.5.18

 - Updated to know about more node-webkit releases

## 0.5.17

 - Updated to know about node v0.10.29 release

## 0.5.16

 - Now supporting all aws-sdk configuration parameters (http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html) (#86)

## 0.5.15

 - Fixed installation of windows packages sub directories on unix systems (#84)

## 0.5.14

 - Finished support for cross building using `--target_platform` option (#82)
 - Now skipping binary validation on install if target arch/platform do not match the host.
 - Removed multi-arch validing for OS X since it required a FAT node.js binary

## 0.5.13

 - Fix problem in 0.5.12 whereby the wrong versions of mkdirp and semver where bundled.

## 0.5.12

 - Improved support for node-webkit (@Mithgol)

## 0.5.11

 - Updated target versions listing

## 0.5.10

 - Fixed handling of `-debug` flag passed directory to node-pre-gyp (#72)
 - Added optional second arg to `node_pre_gyp.find` to customize the default versioning options used to locate the runtime binary
 - Failed install due to `testbinary` check failure no longer leaves behind binary (#70)

## 0.5.9

 - Fixed regression in `testbinary` command causing installs to fail on windows with 0.5.7 (#60)

## 0.5.8

 - Started bundling deps

## 0.5.7

 - Fixed the `testbinary` check, which is used to determine whether to re-download or source compile, to work even in complex dependency situations (#63)
 - Exposed the internal `testbinary` command in node-pre-gyp command line tool
 - Fixed minor bug so that `fallback_to_build` option is always respected

## 0.5.6

 - Added support for versioning on the `name` value in `package.json` (#57).
 - Moved to using streams for reading tarball when publishing (#52)

## 0.5.5

 - Improved binary validation that also now works with node-webkit (@Mithgol)
 - Upgraded test apps to work with node v0.11.x
 - Improved test coverage

## 0.5.4

 - No longer depends on external install of node-gyp for compiling builds.

## 0.5.3

 - Reverted fix for debian/nodejs since it broke windows (#45)

## 0.5.2

 - Support for debian systems where the node binary is named `nodejs` (#45)
 - Added `bin/node-pre-gyp.cmd` to be able to run command on windows locally (npm creates an .npm automatically when globally installed)
 - Updated abi-crosswalk with node v0.10.26 entry.

## 0.5.1

 - Various minor bug fixes, several improving windows support for publishing.

## 0.5.0

 - Changed property names in `binary` object: now required are `module_name`, `module_path`, and `host`.
 - Now `module_path` supports versioning, which allows developers to opt-in to using a versioned install path (#18).
 - Added `remote_path` which also supports versioning.
 - Changed `remote_uri` to `host`.

## 0.4.2

 - Added support for `--target` flag to request cross-compile against a specific node/node-webkit version.
 - Added preliminary support for node-webkit
 - Fixed support for `--target_arch` option being respected in all cases.

## 0.4.1

 - Fixed exception when only stderr is available in binary test (@bendi / #31) 

## 0.4.0

 - Enforce only `https:` based remote publishing access.
 - Added `node-pre-gyp info` command to display listing of published binaries
 - Added support for changing the directory node-pre-gyp should build in with the `-C/--directory` option.
 - Added support for S3 prefixes.

## 0.3.1

 - Added `unpublish` command.
 - Fixed module path construction in tests.
 - Added ability to disable falling back to build behavior via `npm install --fallback-to-build=false` which overrides setting in a depedencies package.json `install` target.

## 0.3.0

 - Support for packaging all files in `module_path` directory - see `app4` for example
 - Added `testpackage` command.
 - Changed `clean` command to only delete `.node` not entire `build` directory since node-gyp will handle that.
 - `.node` modules must be in a folder of there own since tar-pack will remove everything when it unpacks.

