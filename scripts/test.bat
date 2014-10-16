set BASE=%cd%
set NODE_PATH=%BASE%\lib
@rem put local copy of node-pre-gyp on PATH
set PATH=%BASE%\bin;%PATH%
call node-pre-gyp -C test/app1 clean
call node-pre-gyp -C test/app1 unpublish build package testpackage publish info
call node-pre-gyp -C test/app1 clean install
cd test/app1
call npm test
cd %BASE%
call node-pre-gyp -C test/app2 unpublish build package testpackage publish info --custom_include_path=%BASE%\test\app2\include
cd test/app2
call npm test
cd %BASE%
call node-pre-gyp -C test/app3 unpublish build package testpackage publish info
cd test/app3
call npm test
cd %BASE%
call node-pre-gyp -C test/app4 unpublish build package testpackage publish info
cd test/app4
call npm test
cd %BASE%