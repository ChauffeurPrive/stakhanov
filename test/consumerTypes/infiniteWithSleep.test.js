'use strict';

const { expect } = require('chai');
const sinon = require('sinon');

const consumer = require('../../consumerTypes/infiniteWithSleep');

describe('[consumers] infiniteWithSleep', () => {
  const sandbox = sinon.createSandbox();

  const consumerFunc = consumer.infiniteWithSleep(100);

  afterEach(() => {
    sandbox.restore();
  });

  it('should call the handler and return true on success', function* it() {
    const handler = sandbox.stub().resolves(true);
    const logger = {
      error: sandbox.stub()
    };

    const res = yield consumerFunc(handler, logger);

    expect(res).to.equal(true);
    expect(handler.args).to.deep.equal([[]]);
    expect(logger.error.args).to.deep.equal([]);
  });

  it('should call the handler and sleep and return false on error', function* it() {
    const err = new Error('some error');
    const handler = sandbox.stub().rejects(err);
    const logger = {
      error: sandbox.stub()
    };

    const res = yield consumerFunc(handler, logger);

    expect(res).to.equal(false);
    expect(handler.args).to.deep.equal([[]]);
    expect(logger.error.args).to.deep.equal([[
      { err, sleepTime: 100 },
      '[worker#infiniteWithSleep] Error handling message, retrying'
    ]]);
  });
});
