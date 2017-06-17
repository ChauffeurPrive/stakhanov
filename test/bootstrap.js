'use strict';

process.env.USE_BUNYAN_PRETTY_STREAM = 'true';
process.env.LOGGER_LEVEL = process.env.LOGGER_LEVEL || 'info';

const chai = require('chai');

chai.use(require('sinon-chai'));
chai.use(require('dirty-chai'));
