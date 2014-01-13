{
  'variables': {
      "module_name":"app3",
      "module_path":"./lib/"
  },
  "targets": [
    {
      "target_name": "<(module_name)",
      "sources": [ "app3.cc" ],
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
        }
      ]
    }
  ]
}
