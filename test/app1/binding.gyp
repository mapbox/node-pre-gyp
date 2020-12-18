{
  "targets": [
    {
      "target_name": "<(module_name)",
      "sources": [ "<(module_name).cc" ],
      'product_dir': '<(module_path)',
      'include_dirs': [
        '<!@(node --no-warnings -p "require(\'nan\')")',
      ],
      "xcode_settings": {
        "MACOSX_DEPLOYMENT_TARGET":"10.9",
        "CLANG_CXX_LIBRARY": "libc++"
      }
     }
  ]
}
