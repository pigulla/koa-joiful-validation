'use strict';

/* eslint-disable max-statements, one-var-declaration-per-line, no-return-assign, no-sequences */

const co = require('co');
const defer = require('lodash.defer');
const Promise = require('bluebird');

const { evaluate, EvaluationError } = require('../../src/evaluateCustomValidators');

function promise() {
    let resolve, reject;
    const p = new Promise((resolver, rejector) => (resolve = resolver, reject = rejector));

    return { resolve, reject, promise: p };
}

function stubGeneratorWithValue(value) {
    const stub = stubGenerator();

    stub.promise.resolve(value);

    return stub.generator;
}

function stubGenerator() {
    const spy = Sinon.spy();
    const p = promise();

    function* generator() {
        spy.apply(this, arguments);
        return yield p.promise;
    }

    return { generator, spy, promise: p };
}

function deferUntil(fn, max = 100) {
    return new Promise(function (resolve, reject) {
        let count = 0;

        function check() {
            if (count++ > max) {
                return reject(new Error(`Max defer count of ${max} exceeded`));
            } else if (fn()) {
                return resolve();
            } else {
                return defer(check);
            }
        }

        check();
    });
}

describe('Unit evaluateCustomValidators', function () {
    let ctx;

    beforeEach(function () {
        ctx = {
            state: {
                body: {},
                query: {},
                params: {}
            }
        };
    });

    describe('returns the first failing validation', function () {
        it('when used with generators', function () {
            return evaluate(ctx, [
                stubGeneratorWithValue(null),
                stubGeneratorWithValue('A'),
                stubGeneratorWithValue(false),
                stubGeneratorWithValue(undefined),
                stubGeneratorWithValue('B')
            ]).should.eventually.equal('A');
        });

        it('when used with regular functions', function () {
            return evaluate(ctx, [
                Sinon.stub().returns(null),
                Sinon.stub().returns('A'),
                Sinon.stub().returns(false),
                Sinon.stub().returns('B')
            ]).should.eventually.equal('A');
        });

        it('when used with regular functions', function () {
            return evaluate(ctx, [
                Sinon.stub().returns(null),
                Sinon.stub().returns('A'),
                Sinon.stub().returns(false),
                Sinon.stub().returns('B')
            ]).should.eventually.equal('A');
        });

        it('unless everything passes', function () {
            const fns = [
                Sinon.stub().returns(null),
                stubGeneratorWithValue(0),
                Sinon.stub().returns(true),
                stubGeneratorWithValue(42),
                stubGeneratorWithValue({})
            ];

            return evaluate(ctx, fns).should.eventually.equal(null);
        });
    });

    describe('evaluates sequentially', function () {
        let f1, f2, f3, f4, validators;

        beforeEach(function () {
            f1 = stubGenerator();
            f2 = stubGenerator();
            f3 = stubGenerator();
            f4 = stubGenerator();

            validators = [f1.generator, f2.generator, f3.generator, f4.generator];
        });

        it('when all validations succeed', function () {
            const p = evaluate(ctx, validators);

            return co.wrap(function* () {
                yield deferUntil(() => f1.spy.called);

                expect(f1.spy).to.have.been.calledOnce;
                expect(f1.spy).to.have.been.calledOn(ctx);
                expect(f2.spy).not.to.have.been.called;
                expect(f3.spy).not.to.have.been.called;
                expect(f4.spy).not.to.have.been.called;

                f1.promise.resolve();
                yield deferUntil(() => f2.spy.called);

                expect(f2.spy).to.have.been.calledOnce;
                expect(f2.spy).to.have.been.calledOn(ctx);

                expect(f3.spy).not.to.have.been.called;
                expect(f4.spy).not.to.have.been.called;

                f2.promise.resolve();
                yield deferUntil(() => f3.spy.called);

                expect(f3.spy).to.have.been.calledOnce;
                expect(f3.spy).to.have.been.calledOn(ctx);

                expect(f4.spy).not.to.have.been.called;

                f3.promise.resolve();
                yield deferUntil(() => f4.spy.called);

                expect(f4.spy).to.have.been.calledOnce;
                expect(f4.spy).to.have.been.calledOn(ctx);
                // expect(f4.spy).to.have.been.calledWith(ctx.state);

                f4.promise.resolve();

                const result = yield p;

                expect(result).to.equal(null);
            })();
        });

        it('when a validation fails', function () {
            const p = evaluate(ctx, validators);

            return co.wrap(function* () {
                yield deferUntil(() => f1.spy.called);

                expect(f1.spy).to.have.been.calledOnce;
                expect(f1.spy).to.have.been.calledOn(ctx);
                expect(f2.spy).not.to.have.been.called;
                expect(f3.spy).not.to.have.been.called;
                expect(f4.spy).not.to.have.been.called;

                f1.promise.resolve(22);
                yield deferUntil(() => f2.spy.called);

                expect(f2.spy).to.have.been.calledOnce;
                expect(f2.spy).to.have.been.calledOn(ctx);

                expect(f3.spy).not.to.have.been.called;
                expect(f4.spy).not.to.have.been.called;

                f2.promise.resolve('some error');
                const result = yield p;

                expect(f3.spy).not.to.have.been.called;
                expect(f4.spy).not.to.have.been.called;
                expect(result).to.equal('some error');
            })();
        });
    });

    it('handles exceptions in validations', function () {
        return evaluate(ctx, [
            function* () { throw new Error('oh noes'); } // eslint-disable-line require-yield
        ]).should.eventually.be.rejectedWith(EvaluationError);
    });
});
