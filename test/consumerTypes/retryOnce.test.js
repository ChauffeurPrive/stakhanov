'use strict';

const { expect } = require('chai');
const sinon = require('sinon');

const consumer = require('../../consumerTypes/retryOnce');

describe('[consumers] retryOnce', () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it('should call the handler and return true on success', function* it() {
    const handler = sandbox.stub().resolves(true);
    const logger = {
      warn: sandbox.stub(),
      error: sandbox.stub()
    };

    const res = yield consumer.retryOnce(handler, logger, { redelivered: false });

    expect(res).to.equal(true);
    expect(handler.args).to.deep.equal([[]]);
    expect(logger.warn.args).to.deep.equal([]);
    expect(logger.error.args).to.deep.equal([]);
  });

  it('should call the handler and return false on first error', function* it() {
    const err = new Error('some error');
    const handler = sandbox.stub().rejects(err);
    const logger = {
      warn: sandbox.stub(),
      error: sandbox.stub()
    };

    const res = yield consumer.retryOnce(handler, logger, { redelivered: false });

    expect(res).to.equal(false);
    expect(handler.args).to.deep.equal([[]]);
    expect(logger.warn.args).to.deep.equal([[
      { err },
      '[worker#retryOnce] Message handler failed to process message #1 - retrying one time'
    ]]);
    expect(logger.error.args).to.deep.equal([]);
  });

  it('should call the handler and return rtue on second error', function* it() {
    const err = new Error('some error');
    const handler = sandbox.stub().rejects(err);
    const logger = {
      warn: sandbox.stub(),
      error: sandbox.stub()
    };

    const res = yield consumer.retryOnce(handler, logger, { redelivered: true });

    expect(res).to.equal(true);
    expect(handler.args).to.deep.equal([[]]);
    expect(logger.warn.args).to.deep.equal([]);
    expect(logger.error.args).to.deep.equal([[
      { err },
      '[worker#retryOnce] Consumer handler failed to process message #2 - discard message and fail'
    ]]);
  });
});
