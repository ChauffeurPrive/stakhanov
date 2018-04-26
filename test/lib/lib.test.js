'use strict';
'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const amqplib = require('amqplib');

const { promisifyWithTimeout } = require('../../lib/lib');

const amqpUrl = 'amqp://guest:guest@localhost:5672';

describe('lib', () => {
  const queueName = 'test.test_watcher';
  const exchangeName = 'testexchange';
  const sandbox = sinon.sandbox.create();
  let connection;
  let channel;

  before(function* before() {
    connection = yield amqplib.connect(amqpUrl);
    channel = yield connection.createChannel();
    yield channel.deleteQueue(queueName);
  });

  beforeEach(function* beforeEach() {
    yield channel.assertExchange(exchangeName, 'topic');
  });

  afterEach(() => {
    sandbox.restore();
  });

  after(function* after() {
    yield channel.deleteQueue(queueName);
    yield channel.deleteExchange(exchangeName);
    yield connection.close();
  });

  describe('#promisifyWithTimeout', () => {
    it('should timeout if promise is taking too long', function* test() {
      let error;
      const neverResolved = new Promise(resolve => setTimeout(resolve, 1000));
      try {
        yield promisifyWithTimeout(neverResolved, 'test', 100);
      } catch (err) {
        error = err;
      }
      expect(error).to.exist();
      expect(error.toString()).to.equal('Error: Yieldable timeout in test');
    });

    it('should work as expected if the yieldable resolves', function* test() {
      yield promisifyWithTimeout(Promise.resolve(), 'test', 100);
    });

    it('should work as expected if the yieldable rejects', function* test() {
      const rejectedError = new Error();
      let error;
      try {
        yield promisifyWithTimeout(Promise.reject(rejectedError), 'test', 100);
      } catch (err) {
        error = err;
      }
      expect(error).to.equal(rejectedError);
    });
  });
});
