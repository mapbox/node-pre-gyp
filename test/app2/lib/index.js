try {
    var binding = require('pre-gyp-find')('app2',{debug:true});
    require('assert').equal(binding.hello(),"hello-debug");
    console.log('Loaded Debug build');
} catch (err) {
    if (err.code == 'MODULE_NOT_FOUND') {
        var binding = require('pre-gyp-find')('app2',{debug:false});
        require('assert').equal(binding.hello(),"hello-release");        
        console.log('Loaded Release build');
    } else {
        throw err;
    }
}