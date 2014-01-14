{
  'variables': {
      "module_name":"<!(node -e \"console.log(require('./package.json').binary.module_name)\")",
      "module_path":"<!(node -e \"console.log(require('./package.json').binary.module_path)\")",
  },
  "targets": [
    {
      "target_name": "<(module_name)",
      "sources": [ "app4.cpp" ],
      "dependencies": [
        "deps/mylib.gyp:mylib"
      ]
    },
    {
      "target_name": "action_after_build",
      "type": "none",
      "dependencies": [ "<(module_name)" ],
      "copies": [
        {
          "files": [ "<(PRODUCT_DIR)/<(module_name).node" ],
          "destination": "<(module_path)"
        },
        {
          "files": [ "<(PRODUCT_DIR)/mylib<(SHARED_LIB_SUFFIX)" ],
          "destination": "<(module_path)/lib.target/"
        }
      ]
    }
  ]
}


