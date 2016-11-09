'use strict';

/* eslint-disable one-var-declaration-per-line */

const co = require('co');
const Joi = require('joi');
const Promise = require('bluebird');
const proxyquire = require('proxyquire');
const status = require('http-status-codes');

const { ValidationError } = require('../../src/validate');
const { EvaluationError } = require('../../src/evaluateValidators');
const validateMock = Sinon.stub();
const evaluateMock = Sinon.stub();

const validation = proxyquire('../../src/joiful-validation', {
    './validate': { validate: validateMock },
    './evaluateValidators': { evaluate: evaluateMock }
});

describe('Unit joiful-validation', function () {
    let ctx, next;

    beforeEach(function () {
        evaluateMock.reset().resetBehavior();
        validateMock.reset().resetBehavior();

        next = Sinon.stub().yields();
        ctx = {
            state: {},
            params: {},
            request: {
                query: {},
                body: {}
            },
            throw: Sinon.spy()
        };
    });

    it('continues with the request on validation success', function () {
        const fn = validation();

        evaluateMock.returns(Promise.resolve(null));

        return co
            .call(ctx, fn, next)
            .then(function () {
                expect(ctx.throw).not.to.have.been.called;
                expect(next).to.have.been.calledOnce;
            });
    });

    describe('aborts the request', function () {
        describe('when validation fails', function () {
            it('with code 500 for other errors', function () {
                const fn = validation();
                const error = new Error('oh noes');

                validateMock.throws(error);

                return co
                    .call(ctx, fn, next)
                    .then(function () {
                        expect(ctx.throw)
                            .to.have.been.calledOnce.and
                            .to.have.been.calledWith(status.INTERNAL_SERVER_ERROR, error);
                        expect(next).not.to.have.been.called;
                    });
            });

            it('with code 422 for ValidationErrors', function () {
                const fn = validation();
                const cause = new Error('cause');

                cause.details = [{ path: 'x', message: 'foo' }];
                const error = new ValidationError('source', cause);

                validateMock.throws(error);

                return co
                    .call(ctx, fn, next)
                    .then(function () {
                        expect(ctx.throw)
                            .to.have.been.calledOnce.and
                            .to.have.been.calledWith(status.UNPROCESSABLE_ENTITY, error);
                        expect(next).not.to.have.been.called;
                    });
            });
        });

        describe('when a custom functions fails', function () {
            it('with code 422 for an EvaluationError', function () {
                const fn = validation();
                const error = new EvaluationError();

                evaluateMock.returns(cb => cb(error));

                return co
                    .call(ctx, fn, next)
                    .then(function () {
                        expect(ctx.throw)
                            .to.have.been.calledOnce.and
                            .to.have.been.calledWith(status.UNPROCESSABLE_ENTITY);
                        expect(next).not.to.have.been.called;
                    });
            });

            it('with code 500 for an other errors', function () {
                const fn = validation();
                const error = new ReferenceError('oh noes');

                evaluateMock.returns(cb => cb(error));

                return co
                    .call(ctx, fn, next)
                    .then(function () {
                        expect(ctx.throw)
                            .to.have.been.calledOnce.and
                            .to.have.been.calledWith(status.INTERNAL_SERVER_ERROR, error);
                        expect(next).not.to.have.been.called;
                    });
            });
        });
    });

    it('validates in order', function () {
        const schemas = {
            query: Joi.any(),
            params: Joi.any(),
            body: Joi.any()
        };
        const fn = validation(schemas);

        evaluateMock.returns(Promise.resolve(null));

        return co
            .call(ctx, fn, next)
            .then(function () {
                expect(validateMock).to.have.been.calledThrice;
                expect(validateMock.firstCall).to.have.been.calledWith(ctx.params, 'params', schemas.params);
                expect(validateMock.secondCall).to.have.been.calledWith(ctx.request.query, 'query', schemas.query);
                expect(validateMock.thirdCall).to.have.been.calledWith(ctx.request.body, 'body', schemas.body);
            });
    });
});
