var binding = require('node-pre-gyp').binding();

require('assert').equal(binding.hello(),"hello");
