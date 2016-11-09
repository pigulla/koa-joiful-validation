'use strict';

const assert = require('assert-plus');
const ExtendableError = require('es6-error');
const Joi = require('joi');

class ValidationError extends ExtendableError {
    constructor(source, cause) {
        const srcStr = source === 'params' ? 'url' : source;
        const details = cause.details[0];

        super(`Invalid ${srcStr} parameter at .${details.path}: ${details.message}`);

        this.source = source;
        this.cause = cause;
    }
}

/**
 * @param {Object} data
 * @param {String} source
 * @param {Joi.Schema} schema
 * @return {Object}
 */
function validate(data, source, schema) {
    assert.object(data, 'data');
    assert.string(source, 'source');
    assert.object(schema, 'schema');

    const { error, value } = Joi.validate(data, schema, {
        presence: 'required',
        convert: source !== 'body' // convert params and query only
    });

    if (error) {
        throw new ValidationError(source, error);
    }

    return value;
}

module.exports = {
    ValidationError,
    validate
};
