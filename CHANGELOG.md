# node-pre-gyp changelog

## 0.3.0

 - Support for packaging all files in `module_path` directory - see `app4` for example
 - Added `testpackage` command
 - Changed `clean` command to only delete `.node` not entire `build` directory since node-gyp will handle that
 - `.node` modules must be in a folder of there own since tar-pack will remove everything when it unpacks

