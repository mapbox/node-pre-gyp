var binding = require('pre-gyp-find')('app4');

require('assert').equal(binding.hello(),"hello");