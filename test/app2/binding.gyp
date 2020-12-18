{
  "targets": [
    {
      "target_name": "<(module_name)",
      "sources": [ "<(module_name).cc" ],
      'product_dir': '<(module_path)',
      'include_dirs': [
          '<(custom_include_path)',
	  '<!@(node --no-warnings -p "require(\'nan\')")',
      ],
      "xcode_settings": {
        "MACOSX_DEPLOYMENT_TARGET":"10.9",
        "CLANG_CXX_LIBRARY": "libc++"
      }
    }
  ]
}
