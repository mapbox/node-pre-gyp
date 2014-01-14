{
    "targets": [
        {
            "target_name": "mylib",
            "product_name": "mylib",
            "type": "shared_library",
            "sources": [
                "src/implementation.cc"
            ],
            "include_dirs": [
                "include"
            ],
            'direct_dependent_settings': {
              'include_dirs': [ 'include/' ],
            },
            'xcode_settings': {
              'DYLIB_INSTALL_NAME_BASE': '@loader_path/lib.target/'
            }
        }
    ]
}
