[![npm](https://img.shields.io/npm/v/koa-joiful-validation.svg?maxAge=2592000&style=flat-square)](https://www.npmjs.com/package/koa-joiful-validation)
[![Coveralls](https://img.shields.io/coveralls/pigulla/koa-joiful-validation.svg?maxAge=2592000&style=flat-square)](https://coveralls.io/github/pigulla/koa-joiful-validation)
[![Travis CI](https://img.shields.io/travis/pigulla/koa-joiful-validation/master.svg?style=flat-square)](https://travis-ci.org/pigulla/koa-joiful-validation)
[![Dependency Status](https://img.shields.io/david/pigulla/koa-joiful-validation.svg?maxAge=2592000&style=flat-square)](https://david-dm.org/pigulla/koa-joiful-validation)
[![devDependency Status](https://img.shields.io/david/dev/pigulla/koa-joiful-validation.svg?maxAge=2592000&style=flat-square)](https://david-dm.org/pigulla/koa-joiful-validation)
[![peerDependency Status](https://img.shields.io/david/peer/pigulla/koa-joiful-validation.svg?maxAge=2592000&style=flat-square)](https://david-dm.org/pigulla/koa-joiful-validation)
![node](https://img.shields.io/node/v/koa-joiful-validation.svg?maxAge=2592000&style=flat-square)
[![License](https://img.shields.io/npm/l/koa-joiful-validation.svg?maxAge=2592000&style=flat-square)](https://github.com/pigulla/koa-joiful-validation/blob/master/LICENSE)
# koa-joiful-validation
> Simple, opinionated request validation middleware for koa-router.

This module currently supports Koa 1 only.

## Example

bodyParser

```javascript
const Joi = require('joi');
const router = require('koa-router')();
const validate = require('koa-joiful-validation');

router.get('/posts', validate({
    query: {
        offset: Joi.number().integer().min(0).default(0).optional()
        limit: Joi.number().integer().min(0).default(100).optional()
    },
    body: { /* ... */ },   // for the request body
    params: { /* ... */ }, // for route parameters
}), function* () {
    // your code here
    this.request.query // contains the original, unmodified query
    this.state.query   // the modified query with defaults applied, etc.
});
```

#### Why is the result assigned to `this.state`?
Koa's `request` wrapper object automatically serializes all values assigned to its `query` property. This means that its values can not actually be coerced to other types, e.g. to numbers or booleans. To resolve this the modified data (conversions and defaults applied) are assigned to `this.state.body`, `this.state.query` and `this.state.params` instead.

## Installation

Install as usual:
```javascript
npm install --save koa-joiful-validation
```

Please note that this module has [Joi](https://github.com/hapijs/joi) as a peer dependency (practically any version will do).

## Opinions
This module is quite opinionated. If it doesn't suit your needs, feel free to open an issue, create a pull request or just fork the project. In particular, keep the following things in mind: 

 - If a validation fails, so does the request with a `422 UNPROCESSABLE ENTITY` error.
 - All parameters are required by default (`presence: 'required'`).
 - When no schema is given, the empty schema is assumed. This means that `router.post('/', validate(), ...)` will not accept any query or body parameters.
 - By default, query and url parameters are converted (e.g., cast to numbers as necessary), but body parameters are not.

## Details

### Custom validation functions
You can pass a list of custom validation functions as a second parameter:
```javascript
router.get('/equalsTen', validate({
    x: Joi.number(),
    y: Joi.number()
}, [
    function () {
        // 'this' is the regular koa context
        const { x, y } = this.state.params;
        if (x + y !== 10) {
            // Joi already converted the parameters from strings to numbers
            return 'x plus y must equal ten!';
        }
    }
]), function* () {
    // ...
});
````
These functions are run in sequence after the schema validations (and only if those succeed). If a function returns a string, that validation is considered to have failed and the string becomes the error message. Any other return value is interpreted as a success.

The functions are executed in the same context as the middleware itself so you have access to `this.request`, `this.state` etc.

If your validation is asynchronous, simply use a generator. To fail the validation reject it with an arbitrary error:
```javascript
router.get('/:id', validate({
    params: { id: Joi.number() }
}, [
    function* () {
        const entity = yield this.db.findOne(this.state.params.id);
        return entity.isSpecial ? Promise.reject(new Error('too special!')) : entity;
    }
], function* () {
    // ...
});
````

### Auto-wrapping

The values given in the configuration object are automatically passed to `Joi.object().keys()` if they are not already Joi schemas. In other words, the following two statements are equivalent:
```javascript
validate({ query: { x: Joi.number() } });
validate({ query: Joi.object().keys({ x: Joi.number() }) });
```
