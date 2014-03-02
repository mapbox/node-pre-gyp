{
  "targets": [
    {
      "target_name": "<(module_name)",
      "sources": [ "<(module_name).cc" ],
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
          "destination": "<(module_path)/"
        }
      ]
    }
  ]
}
