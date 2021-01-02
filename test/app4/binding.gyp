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
      }
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
      ],
      'conditions': [
          ['OS == "win"', {
             "copies": [
               {
                "files": [ "<(PRODUCT_DIR)/mylib<(SHARED_LIB_SUFFIX)" ],
                "destination": "<(module_path)/"
               }
             ]
          }, {
             "copies": [
               {
                "files": [ "<(PRODUCT_DIR)/mylib<(SHARED_LIB_SUFFIX)" ],
                "destination": "<(module_path)/lib.target/"
               }
             ]
          }
          ]
      ]
    }
  ]
}


