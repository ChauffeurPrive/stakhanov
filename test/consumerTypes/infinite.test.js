'use strict';

const { expect } = require('chai');
const sinon = require('sinon');

const consumer = require('../../consumerTypes/infinite');

describe('[consumers] infinite', () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it('should call the handler and return true on success', function* it() {
    const handler = sandbox.stub().resolves(true);
    const logger = {
      error: sandbox.stub()
    };

    const res = yield consumer.infinite(handler, logger);

    expect(res).to.equal(true);
    expect(handler.args).to.deep.equal([[]]);
    expect(logger.error.args).to.deep.equal([]);
  });

  it('should call the handler and return false on error', function* it() {
    const err = new Error('some error');
    const handler = sandbox.stub().rejects(err);
    const logger = {
      error: sandbox.stub()
    };

    const res = yield consumer.infinite(handler, logger);

    expect(res).to.equal(false);
    expect(handler.args).to.deep.equal([[]]);
    expect(logger.error.args).to.deep.equal([[
      { err },
      '[worker#infinite] Error handling message, retrying'
    ]]);
  });
});
