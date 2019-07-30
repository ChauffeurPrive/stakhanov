'use strict';

const { expect } = require('chai');
const sinon = require('sinon');

const consumer = require('../../consumerTypes/noRetry');

describe('[consumers] noRetry', () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it('should call the handler and return true on success', function* it() {
    const handler = sandbox.stub().resolves(true);
    const logger = {
      error: sandbox.stub()
    };

    const res = yield consumer.noRetry(handler, logger);

    expect(res).to.equal(true);
    expect(handler.args).to.deep.equal([[]]);
    expect(logger.error.args).to.deep.equal([]);
  });

  it('should call the handler and return true on error', function* it() {
    const err = new Error('some error');
    const handler = sandbox.stub().rejects(err);
    const logger = {
      error: sandbox.stub()
    };

    const res = yield consumer.noRetry(handler, logger);

    expect(res).to.equal(true);
    expect(handler.args).to.deep.equal([[]]);
    expect(logger.error.args).to.deep.equal([[
      { err },
      '[worker#noRetry] Error handling message, dropping'
    ]]);
  });
});
