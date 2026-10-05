'use strict';

const js = require('@eslint/js');
const stylistic = require('@stylistic/eslint-plugin');
const n = require('eslint-plugin-n');
const globals = require('globals');

module.exports = [
  {
    ignores: ['coverage/']
  },
  js.configs.recommended,
  {
    files: ['**/*.js', 'bin/node-pre-gyp'],
    plugins: {
      '@stylistic': stylistic,
      n
    },
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'commonjs',
      globals: {
        ...globals.node
      }
    },
    rules: {
      'no-var': 'error',
      'prefer-const': 'error',
      'eqeqeq': ['error', 'smart'],
      'no-extend-native': 'error',
      'no-use-before-define': ['error', 'nofunc'],
      'strict': 'error',
      'no-console': 'off',
      'no-shadow': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      'prefer-arrow-callback': 'error',

      'n/no-unsupported-features/es-builtins': 'error',
      'n/no-unsupported-features/es-syntax': 'error',
      'n/no-unsupported-features/node-builtins': 'error',
      'n/no-missing-require': 'error',

      '@stylistic/array-bracket-spacing': ['error', 'never'],
      '@stylistic/arrow-parens': ['error', 'always'],
      '@stylistic/comma-dangle': ['error', 'never'],
      '@stylistic/comma-spacing': 'error',
      '@stylistic/computed-property-spacing': ['error', 'never'],
      '@stylistic/eol-last': 'error',
      '@stylistic/function-call-spacing': ['error', 'never'],
      '@stylistic/indent': ['error', 2, { SwitchCase: 1 }],
      '@stylistic/key-spacing': 'error',
      '@stylistic/keyword-spacing': ['error', { before: true, after: true }],
      '@stylistic/no-confusing-arrow': ['error', { allowParens: false }],
      '@stylistic/no-mixed-spaces-and-tabs': 'error',
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/object-curly-spacing': ['error', 'always'],
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
      '@stylistic/rest-spread-spacing': ['error', 'never'],
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/semi-spacing': 'error',
      '@stylistic/space-before-blocks': 'error',
      '@stylistic/space-before-function-paren': ['error', {
        anonymous: 'never',
        named: 'never',
        asyncArrow: 'always'
      }],
      '@stylistic/space-in-parens': ['error', 'never'],
      '@stylistic/space-infix-ops': 'error',
      '@stylistic/spaced-comment': ['error', 'always'],
      '@stylistic/template-curly-spacing': ['error', 'never']
    }
  }
];
