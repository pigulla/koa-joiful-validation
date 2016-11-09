'use strict';

const chai = require('chai');
const sinonChai = require('sinon-chai');
const chaiAsPromised = require('chai-as-promised');
const Sinon = require('sinon');

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

global.expect = chai.expect;
global.Sinon = Sinon;
