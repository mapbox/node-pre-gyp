@ECHO OFF
SETLOCAL
SET EL=0

ECHO =========== %~f0 ===========

set BASE=%cd%
set NODE_PATH=%BASE%\lib
@rem put local copy of node-pre-gyp on PATH
set PATH=%BASE%\bin;%PATH%

ECHO "==== app1 ==="
ECHO "---- node-pre-gyp -C test/app1 clean"
call node-pre-gyp -C test/app1 clean
IF %ERRORLEVEL% NEQ 0 GOTO ERROR

ECHO "---- node-pre-gyp -C test/app1 unpublish build package testpackage publish info"
call node-pre-gyp -C test/app1 unpublish build package testpackage publish info
IF %ERRORLEVEL% NEQ 0 GOTO ERROR

ECHO "---- node-pre-gyp -C test/app1 clean install"
call node-pre-gyp -C test/app1 clean install
IF %ERRORLEVEL% NEQ 0 GOTO ERROR

cd test/app1

ECHO "---- npm test"
call npm test
IF %ERRORLEVEL% NEQ 0 GOTO ERROR

cd %BASE%

ECHO "==== app2 ==="
ECHO "---- node-pre-gyp -C test/app2 unpublish build package testpackage publish info --custom_include_path=%BASE%\test\app2\include"
call node-pre-gyp -C test/app2 unpublish build package testpackage publish info --custom_include_path=%BASE%\test\app2\include
IF %ERRORLEVEL% NEQ 0 GOTO ERROR

cd test/app2

ECHO "---- npm test"
call npm test
IF %ERRORLEVEL% NEQ 0 GOTO ERROR

cd %BASE%

ECHO "==== app3 ==="
ECHO "---- node-pre-gyp -C test/app3 unpublish build package testpackage publish info"
call node-pre-gyp -C test/app3 unpublish build package testpackage publish info
IF %ERRORLEVEL% NEQ 0 GOTO ERROR

cd test/app3

ECHO "----  npm test"
call npm test
IF %ERRORLEVEL% NEQ 0 GOTO ERROR

cd %BASE%

ECHO "==== app4 ==="
ECHO "---- node-pre-gyp -C test/app4 unpublish build package testpackage publish info"
call node-pre-gyp -C test/app4 unpublish build package testpackage publish info
IF %ERRORLEVEL% NEQ 0 GOTO ERROR

cd test/app4

ECHO "---- npm test"
call npm test
IF %ERRORLEVEL% NEQ 0 GOTO ERROR

cd %BASE%

GOTO DONE

:ERROR
ECHO =========== ERROR %~f0 ===========
ECHO ERRORLEVEL^: %ERRORLEVEL%
SET EL=%ERRORLEVEL%

:DONE
ECHO =========== DONE %~f0 ===========

EXIT /b %EL%
