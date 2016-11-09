'use strict';

/* eslint-disable one-var-declaration-per-line, newline-per-chained-call */

const Koa = require('koa');
const Router = require('koa-router');
const Joi = require('joi');
const request = require('request');
const Promise = require('bluebird');
const bodyParser = require('koa-bodyparser');
const { UNPROCESSABLE_ENTITY, OK } = require('http-status-codes');

const validation = require('../../src/joiful-validation');

function* jsonError(next) {
    try {
        yield next;
    } catch (error) {
        this.status = error.status;
        this.body = {
            name: error.name,
            message: error.message
        };
    }
}

function* echo() { // eslint-disable-line require-yield
    this.body = {
        params: this.state.params,
        query: this.state.query,
        body: this.state.body
    };
}

describe('End-to-End', function () {
    const app = new Koa();
    let server;

    before(function () {
        app.use(jsonError).use(bodyParser());

        return Promise.fromCallback(cb => server = app.listen(cb)); // eslint-disable-line no-return-assign
    });

    after(function () {
        return Promise.fromCallback(cb => server.close(cb));
    });

    function get() {
        return req('get', ...arguments);
    }

    function post() {
        return req('post', ...arguments);
    }

    function req(method, pathname, query = {}, body = null) {
        const { address, port } = server.address();

        return Promise
            .fromCallback(cb => request({
                method,
                url: {
                    protocol: 'http:',
                    hostname: address,
                    port,
                    pathname
                },
                body,
                qs: query,
                json: true
            }, cb), { multiArgs: true });
    }

    describe('/optional', function () {
        before(function () {
            const router = new Router();

            router.all('/optional', validation({
                body: Joi.object().keys({
                    foo: Joi.boolean().optional(),
                    bar: Joi.number().options({ convert: false }).optional()
                })
            }), echo);
            app.use(router.routes());
        });

        it('with invalid query', function () {
            return post('/optional', {}, { foo: true, bar: '42' })
                .spread(function (message, body) {
                    expect(message.statusCode).to.equal(UNPROCESSABLE_ENTITY);
                    expect(body.message).to.equal('Invalid body parameter at .bar: "bar" must be a number');
                });
        });

        it('without query', function () {
            return post('/optional', {}, {})
                .spread(function (message, body) {
                    expect(message.statusCode).to.equal(OK);
                    expect(body).to.deep.equal({
                        params: {},
                        query: {},
                        body: {}
                    });
                });
        });

        it('with valid query', function () {
            return post('/optional', {}, { foo: true, bar: 42 })
                .spread(function (message, body) {
                    expect(message.statusCode).to.equal(OK);
                    expect(body).to.deep.equal({
                        params: {},
                        query: {},
                        body: {
                            foo: true,
                            bar: 42
                        }
                    });
                });
        });
    });

    describe('/default', function () {
        before(function () {
            const router = new Router();

            router.all('/defaults', validation({
                query: {
                    foo: Joi.string().default('bar').optional()
                }
            }), echo);
            app.use(router.routes());
        });

        it('without query', function () {
            return get('/defaults', {}, {})
                .spread(function (message, body) {
                    expect(message.statusCode).to.equal(OK);
                    expect(body).to.deep.equal({
                        params: {},
                        query: {
                            foo: 'bar'
                        },
                        body: {}
                    });
                });
        });

        it('with valid query', function () {
            return get('/defaults', { foo: 'baz' }, {})
                .spread(function (message, body) {
                    expect(message.statusCode).to.equal(OK);
                    expect(body).to.deep.equal({
                        params: {},
                        query: {
                            foo: 'baz'
                        },
                        body: {}
                    });
                });
        });
    });

    describe('/convert', function () {
        before(function () {
            const router = new Router();

            router.all('/convert', validation({
                query: {
                    foo: Joi.number().default(42).optional()
                }
            }), echo);
            app.use(router.routes());
        });

        it('with invalid query', function () {
            return get('/convert', { foo: 'bar' }, {})
                .spread(function (message, body) {
                    expect(message.statusCode).to.equal(UNPROCESSABLE_ENTITY);
                    expect(body.message).to.equal('Invalid query parameter at .foo: "foo" must be a number');
                });
        });

        it('without query', function () {
            return get('/convert', {}, {})
                .spread(function (message, body) {
                    expect(message.statusCode).to.equal(OK);
                    expect(body).to.deep.equal({
                        params: {},
                        query: {
                            foo: 42
                        },
                        body: {}
                    });
                });
        });

        it('with valid query', function () {
            return get('/convert', { foo: 13 }, {})
                .spread(function (message, body) {
                    expect(message.statusCode).to.equal(OK);
                    expect(body).to.deep.equal({
                        params: {},
                        query: {
                            foo: 13
                        },
                        body: {}
                    });
                });
        });
    });

    describe('/route/with/:param/:id', function () {
        before(function () {
            const router = new Router();

            router.all('/route/with/:param/active/:active/:id', validation({
                params: {
                    active: Joi.boolean(),
                    param: Joi.string().only('foo', 'bar'),
                    id: Joi.number()
                }
            }), echo);
            app.use(router.routes());
        });

        it('with convertable parameter', function () {
            return get('/route/with/foo/active/1/42', {}, {})
                .spread(function (message, body) {
                    expect(message.statusCode).to.equal(OK);
                    expect(body).to.deep.equal({
                        params: {
                            param: 'foo',
                            active: true,
                            id: 42
                        },
                        query: {},
                        body: {}
                    });
                });
        });

        it('with invalid parameter', function () {
            return get('/route/with/foo/active/1/x42', {}, {})
                .spread(function (message, body) {
                    expect(message.statusCode).to.equal(UNPROCESSABLE_ENTITY);
                    expect(body.message).to.equal('Invalid url parameter at .id: "id" must be a number');
                });
        });
    });

    describe('/nothing', function () {
        before(function () {
            const router = new Router();

            router.all('/nothing', validation(), echo);
            app.use(router.routes());
        });

        it('without anything', function () {
            return post('/nothing', {}, {})
                .spread(function (message, body) {
                    expect(message.statusCode).to.equal(OK);
                    expect(body).to.deep.equal({
                        params: {},
                        query: {},
                        body: {}
                    });
                });
        });

        it('with query', function () {
            return post('/nothing', { x: 42 }, {})
                .spread(function (message, body) {
                    expect(message.statusCode).to.equal(UNPROCESSABLE_ENTITY);
                    expect(body.message).to.equal('Invalid query parameter at .x: "x" is not allowed');
                });
        });

        it('with body', function () {
            return post('/nothing', {}, { x: 42 })
                .spread(function (message, body) {
                    expect(message.statusCode).to.equal(UNPROCESSABLE_ENTITY);
                    expect(body.message).to.equal('Invalid body parameter at .x: "x" is not allowed');
                });
        });
    });
});
