'use strict';

const { infinite } = require('./infinite');
const { infiniteWithSleep } = require('./infiniteWithSleep');
const { noRetry } = require('./noRetry');
const { retryOnce } = require('./retryOnce');

module.exports = {
  infinite,
  infiniteWithSleep,
  noRetry,
  retryOnce
};
