{
  "targets": [
    {
      "target_name": "<(module_name)",
      "sources": [ "<(module_name).cc" ],
      'include_dirs': [
          '<(custom_include_path)',
          "../../node_modules/node-addon-api/"
      ],
      'product_dir': '<(module_path)',
      'cflags!': [ '-fno-exceptions' ],
      'cflags_cc!': [ '-fno-exceptions' ],
      "xcode_settings": {
        'GCC_ENABLE_CPP_EXCEPTIONS': 'YES',
        "CLANG_CXX_LIBRARY": "libc++"
      }
    }
  ]
}
