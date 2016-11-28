{
  "targets": [
    {
      "target_name": "<(module_name)",
      "sources": [ "<(module_name).cpp" ],
      "dependencies": [
        "deps/mylib.gyp:mylib"
      ],
      "ldflags": [ "-Wl,-z,now" ],
      "xcode_settings": {
        "OTHER_LDFLAGS":[ "-Wl,-bind_at_load" ],
        "MACOSX_DEPLOYMENT_TARGET":"10.8",
        "CLANG_CXX_LIBRARY": "libc++"
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


