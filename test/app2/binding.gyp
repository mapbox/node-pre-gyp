{
  "targets": [
    {
      "target_name": "<(module_name)",
      "sources": [ "<(module_name).cc" ],
      'include_dirs': [
          '<(custom_include_path)'
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
