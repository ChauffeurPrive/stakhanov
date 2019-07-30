'use strict';

const { expect } = require('chai');
const sinon = require('sinon');

const consumer = require('../../consumerTypes/handlerResult');

describe('[consumers] handlerResult', () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it('should call the handler result on success if it returns true', function* it() {
    const handler = sandbox.stub().resolves(true);
    const logger = {
      error: sandbox.stub()
    };

    const res = yield consumer.handlerResult(handler, logger);

    expect(res).to.equal(true);
    expect(handler.args).to.deep.equal([[]]);
    expect(logger.error.args).to.deep.equal([]);
  });

  it('should call the handler result on success if it returns false', function* it() {
    const handler = sandbox.stub().resolves(false);
    const logger = {
      error: sandbox.stub()
    };

    const res = yield consumer.handlerResult(handler, logger);

    expect(res).to.equal(false);
    expect(handler.args).to.deep.equal([[]]);
    expect(logger.error.args).to.deep.equal([]);
  });

  it('should call the handler and return false on error', function* it() {
    const err = new Error('some error');
    const handler = sandbox.stub().rejects(err);
    const logger = {
      error: sandbox.stub()
    };

    const res = yield consumer.handlerResult(handler, logger);

    expect(res).to.equal(false);
    expect(handler.args).to.deep.equal([[]]);
    expect(logger.error.args).to.deep.equal([[
      { err },
      '[worker#handlerResult] Error handling message, retrying'
    ]]);
  });
});
