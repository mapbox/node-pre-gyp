{
  "targets": [
    {
      "target_name": "<(module_name)",
      "sources": [ "<(module_name).cpp" ],
      "dependencies": [
        "deps/mylib.gyp:mylib"
      ],
      'include_dirs': [
        '<!@(node --no-warnings -p "require(\'nan\')")',
      ],
      "xcode_settings": {
        "MACOSX_DEPLOYMENT_TARGET":"10.9",
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


