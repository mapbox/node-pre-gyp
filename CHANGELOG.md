# node-pre-gyp changelog

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
 - Added ability to disable falling back to build behavior via `npm install --fallback-to-buil=false` which overrides setting in a depedencies package.json `install` target.

## 0.3.0

 - Support for packaging all files in `module_path` directory - see `app4` for example
 - Added `testpackage` command.
 - Changed `clean` command to only delete `.node` not entire `build` directory since node-gyp will handle that.
 - `.node` modules must be in a folder of there own since tar-pack will remove everything when it unpacks.

