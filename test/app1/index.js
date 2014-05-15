var binding = require('pre-gyp-find')('app1');

require('assert').equal(binding.hello(),"hello");
