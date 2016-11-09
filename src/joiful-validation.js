'use strict';

const assert = require('assert-plus');
const Joi = require('joi');
const status = require('http-status-codes');

const { validate, ValidationError } = require('./validate');
const { evaluate, EvaluationError } = require('./evaluateValidators');

/**
 * @param {Object.<String, Joi.Schema>=} schemas
 * @param {Array.<Function>=} functions
 * @return {Function}
 */
function joifulValidate(schemas = {}, functions = []) {
    assert.object(schemas, 'schemas');
    assert.arrayOfFunc(functions, 'functions');

    ['params', 'query', 'body'].forEach(function (name) {
        const schema = schemas[name] || {};
        const isJoiSchema = typeof schema === 'object' && schema.isJoi;

        schemas[name] = isJoiSchema ? schema : Joi.object().keys(schema);
    });

    return function* (next) { // eslint-disable-line consistent-return
        try {
            this.state.params = validate(this.params, 'params', schemas.params);
            this.state.query = validate(this.request.query, 'query', schemas.query);
            this.state.body = validate(this.request.body, 'body', schemas.body);

            yield evaluate(this, functions);
        } catch (err) {
            if (err instanceof ValidationError || err instanceof EvaluationError) {
                return this.throw(status.UNPROCESSABLE_ENTITY, err);
            } else {
                return this.throw(status.INTERNAL_SERVER_ERROR, err);
            }
        }

        yield next;
    };
}

module.exports = joifulValidate;
