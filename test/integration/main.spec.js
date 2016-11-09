'use strict';

/* eslint-disable one-var-declaration-per-line, newline-per-chained-call */

const co = require('co');
const Joi = require('joi');
const Promise = require('bluebird');
const status = require('http-status-codes');

const validation = require('../../src/joiful-validation');

describe('Integration', function () {
    let ctx, next;

    beforeEach(function () {
        next = Sinon.stub().yields();
        ctx = {
            params: {},
            request: {
                query: {},
                body: {}
            },
            state: {},
            throw: Sinon.spy()
        };
    });

    function run(fn, expectedError = null) {
        return Promise
            .resolve(co.call(ctx, fn, next))
            .then(function () {
                if (expectedError) {
                    const { source, path, message } = expectedError;

                    expect(next).not.to.have.been.called;
                    expect(ctx.throw).to.have.been.calledOnce
                        .and.to.have.been.calledWithMatch(
                            Sinon.match(status.UNPROCESSABLE_ENTITY),
                            Sinon.match.instanceOf(Error));

                    const validationError = ctx.throw.firstCall.args[1];
                    const details = validationError.cause.details[0];

                    expect(validationError.source).to.equal(source);
                    expect(details.path).to.equal(path);
                    expect(details.message).to.match(message);
                } else {
                    expect(ctx.throw).not.to.have.been.called;
                    expect(next).to.have.been.calledOnce;
                }
            })
            .then(() => ctx.state);
    }

    it('succeeds for empty schema', function () {
        return run(validation());
    });

    describe('fails for empty schema', function () {
        it('when query parameters are set', function () {
            ctx.request.query.foo = 42;

            return run(validation(), {
                source: 'query',
                path: 'foo',
                message: /"foo" is not allowed/
            });
        });

        it('when url parameters are set', function () {
            ctx.params.bar = 42;

            return run(validation(), {
                source: 'params',
                path: 'bar',
                message: /"bar" is not allowed/
            });
        });

        it('when body parameters are set', function () {
            ctx.request.body.baz = 42;

            return run(validation(), {
                source: 'body',
                path: 'baz',
                message: /"baz" is not allowed/
            });
        });
    });

    it('reports error path with a nested schema', function () {
        ctx.request.query = { x: { y: { z: ['a', 1] } } };

        return run(validation({
            query: {
                x: Joi.object().keys({
                    y: Joi.object().keys({
                        z: Joi.array().items(Joi.string())
                    })
                })
            }
        }), {
            source: 'query',
            path: 'x.y.z.1',
            message: /"1" must be a string/
        });
    });

    describe('with a simple schema', function () {
        const schema = {
            s: Joi.string(),
            n: Joi.number().optional().default(42),
            b: Joi.boolean()
        };

        it('fails if data is invalid', function () {
            ctx.request.query = { s: '42', n: 13, b: 'x' };

            return run(validation({ query: schema }), {
                source: 'query',
                path: 'b',
                message: /"b" must be a boolean/
            });
        });

        it('applies defaults', function () {
            ctx.request.body = { s: 'foo', b: true };

            return run(validation({ body: schema }))
                .then(state => expect(state.body).to.deep.equal({
                    s: 'foo',
                    n: 42,
                    b: true
                }));
        });

        it('converts query parameters', function () {
            ctx.request.query = { s: 'foo', n: '13', b: '1' };

            return run(validation({ query: schema }))
                .then(state => expect(state.query).to.deep.equal({
                    s: 'foo',
                    n: 13,
                    b: true
                }));
        });

        it('does not convert body parameters by default', function () {
            ctx.request.body = { s: 'foo', n: '42', b: '1' };

            return run(validation({ body: schema }), {
                source: 'body',
                path: 'n',
                message: /"n" must be a number/
            });
        });

        it('converts body parameters if requested', function () {
            ctx.request.body = { n: '42' };

            return run(validation({
                body: {
                    n: Joi.number().options({ convert: true })
                }
            })).then(state => expect(state.body).to.deep.equal({ n: 42 }));
        });
    });
});
