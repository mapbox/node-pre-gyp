var binding = require('pre-gyp-find')('app3');

require('assert').equal(binding.hello(),"hello");