'use strict';

const assert = require('assert-plus');
const co = require('co');
const ExtendableError = require('es6-error');
const Promise = require('bluebird');

class EvaluationError extends ExtendableError {
    /**
     * @param {Error} cause
     */
    constructor(cause) {
        super('Error while evaluating validation');

        this.cause = cause;
    }
}

/**
 * @param {Object} ctx
 * @param {Array.<Function>} functions
 * @return {Promise.<Array.<String>>}
 */
function evaluate(ctx, functions) {
    assert.object(ctx, 'ctx');
    assert.arrayOfFunc(functions, 'functions');

    return Promise
        .resolve(functions)
        .reduce(function (firstError, fn) {
            return firstError ? firstError : co.wrap(fn).call(ctx)
                .then(result => (typeof result === 'string' ? result : null))
                .catch(error => { throw new EvaluationError(error); });
        }, null);
}

module.exports = {
    evaluate,
    EvaluationError
};
