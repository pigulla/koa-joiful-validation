'use strict';

/* eslint-disable global-require, no-process-env */

module.exports = function (wallaby) {
    return {
        debug: true,
        files: [
            'test/setup.js',
            'src/**/*.js'
        ],
        tests: [
            '!test/setup.js',
            'test/**/*.spec.js'
        ],
        testFramework: 'mocha',
        env: {
            type: 'node'
        },
        setup(wallabyInstance) {
            require('./test/setup');
        }
    };
};
