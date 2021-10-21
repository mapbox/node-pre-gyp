{
  "targets": [
    {
      "target_name": "<(module_name)",
      "sources": [ "<(module_name).cpp" ],
      "dependencies": [
        "deps/mylib.gyp:mylib"
      ],
      'include_dirs': ["../../node_modules/node-addon-api/"],
      'cflags!': [ '-fno-exceptions' ],
      'cflags_cc!': [ '-fno-exceptions' ],
      "xcode_settings": {
        'GCC_ENABLE_CPP_EXCEPTIONS': 'YES',
        "CLANG_CXX_LIBRARY": "libc++"
      },
      'msvs_settings': {
        'VCCLCompilerTool': { 'ExceptionHandling': 1 },
      },
      # gyp inside node v16 uses -rpath=$ORIGIN/ instead of -rpath=$ORIGIN/lib.target/
      # which fixes a longstanding descreptancy between platforms as documented at https://github.com/nodejs/node-gyp/issues/2233
      # This allows tests to pass for older, still buggy and inconsistent versions of node-gyp (and will be duplicative for npm >= 7 which bundles node-gyp >= v0.6.0)
      'ldflags': [
        "-Wl,-rpath=\$$ORIGIN/"
      ],
    },
    {
      "target_name": "action_after_build",
      "type": "none",
      "dependencies": [ "<(module_name)" ],
      "copies": [
        {
            "files": [ "<(PRODUCT_DIR)/<(module_name).node" ],
            "destination": "<(module_path)/"
        },
        {
            "files": [ "<(PRODUCT_DIR)/mylib<(SHARED_LIB_SUFFIX)" ],
            "destination": "<(module_path)/"
        }
      ]
    }
  ]
}


