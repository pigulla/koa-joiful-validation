'use strict';

const Joi = require('joi');
const proxyquire = require('proxyquire');

const joiMock = {};
const { validate, ValidationError } = proxyquire('../../src/validate', {
    joi: joiMock
});

describe('Unit validate', function () {
    const params = {};
    const query = {};
    const body = {};
    let ctx;

    beforeEach(function () {
        joiMock.validate = Sinon.stub();
        ctx = {
            request: { params, query, body },
            throw: Sinon.spy()
        };
    });

    it('aborts the request', function () {
        const error = new Error('oh noes');
        const schema = Joi.any();

        error.details = [{ path: 'a.b.c', message: 'not awesome enough' }];

        joiMock.validate.returns({ error, value: null });

        expect(() => validate(body, 'body', schema)).to.throw(ValidationError);
        expect(joiMock.validate).to.have.been.calledOnce
            .and.to.have.been.calledWith(body, schema, Sinon.match.object);
    });

    it('returns the updated value', function () {
        const updatedValue = {};
        const schema = {};

        joiMock.validate.returns({ error: null, value: updatedValue });

        const result = validate(ctx, 'body', schema);

        expect(ctx.throw).not.to.have.been.called;
        expect(result).to.equal(updatedValue);
    });
});
