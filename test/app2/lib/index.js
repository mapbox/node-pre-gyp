try {
    var binding = require('node-pre-gyp').binding({debug:true});
    require('assert').equal(binding.hello(),"hello-debug");
    console.log('Loaded Debug build');
} catch (err) {
    if (err.code == 'MODULE_NOT_FOUND') {
        var binding = require('node-pre-gyp').binding();
        require('assert').equal(binding.hello(),"hello-release");        
        console.log('Loaded Release build');
    } else {
        throw err;
    }
}