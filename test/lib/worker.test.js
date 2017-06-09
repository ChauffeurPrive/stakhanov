'use strict';

const _ = require('lodash');
const { expect } = require('chai');
const sinon = require('sinon');
const amqplib = require('amqplib');
const EventEmitter = require('events');

const { createWorkers } = require('../../lib/createWorkers');

const amqpUrl = 'amqp://guest:guest@localhost:5672';

class ChannelStub extends EventEmitter {
  * prefetch() {} // eslint-disable-line no-empty-function
  * assertExchange() {} // eslint-disable-line no-empty-function
  * assertQueue() {} // eslint-disable-line no-empty-function
  * bindQueue() {} // eslint-disable-line no-empty-function
  * consume() {} // eslint-disable-line no-empty-function
}
class ConnectionStub extends EventEmitter {
  constructor(channelStub) {
    super();

    this.channelStub = channelStub;
  }
  * createChannel() {
    return this.channelStub || new ChannelStub();
  }
}

describe('Worker library', () => {
  const workerName = 'test';
  const queueName = 'test.test_watcher';
  const exchangeName = 'testexchange';
  const routingKey = 'test.something_happened';
  const logger = {
    debug: () => null,
    info: () => null,
    warn: () => null,
    error: () => null
  };

  const formattedQueueName = `${queueName}.${routingKey}`;
  const messageContent = { test: 'message' };
  const messageContent2 = { test: 'message2' };
  const sandbox = sinon.sandbox.create();
  let connection;
  let channel;

  before(function* before() {
    connection = yield amqplib.connect(amqpUrl);
    channel = yield connection.createChannel();
    yield channel.deleteQueue(formattedQueueName);
  });

  beforeEach(function* beforeEach() {
    yield channel.assertExchange(exchangeName, 'topic');
  });

  afterEach(() => {
    sandbox.restore();
  });

  after(function* after() {
    yield channel.deleteQueue(formattedQueueName);
    yield channel.deleteExchange(exchangeName);
    yield connection.close();
  });

  describe('#listening', () => {
    it('should log an error and throw if connection fails', function* test() {
      sandbox.stub(amqplib, 'connect').throws();
      sandbox.spy(logger, 'error');
      let error;
      let worker;
      try {
        worker = createWorkers([{
          handle: () => true,
          validate: _.identity,
          routingKey
        }], {
          workerName,
          amqpUrl,
          exchangeName,
          queueName
        }, { logger });
        yield worker.listen();
      } catch (err) {
        error = err;
      }
      expect(error).to.exist();
      expect(logger.error).to.have.callCount(1);
      yield worker.close(false);
    });

    it('should log and discard message if invalid JSON', function* test() {
      sandbox.spy(logger, 'warn');
      const worker = createWorkers([{
        handle: () => true,
        validate: _.identity,
        routingKey
      }], {
        workerName,
        amqpUrl,
        exchangeName,
        queueName
      }, { logger });
      yield worker.listen();
      channel.publish(exchangeName, routingKey, new Buffer('test'));
      yield cb => setTimeout(cb, 100);
      expect(logger.warn).to.have.callCount(1);
      yield worker.close(false);
    });

    it('should call message validation if provided', function* test() {
      let validatorCalled = false;
      let workerCalled = false;
      const worker = createWorkers([{
        handle: function* handle() {
          workerCalled = true;
          return true;
        },
        validate: () => {
          validatorCalled = true;
          return true;
        },
        routingKey
      }], {
        workerName,
        amqpUrl,
        exchangeName,
        queueName
      });
      yield worker.listen();
      channel.publish(exchangeName, routingKey, new Buffer(JSON.stringify(messageContent)));
      yield cb => setTimeout(cb, 100);
      expect(validatorCalled).to.be.true();
      expect(workerCalled).to.be.true();
      yield worker.close(false);
    });

    it('should not call handler and fail if validator throws', function* test() {
      sandbox.spy(logger, 'warn');
      let validatorCalled = false;
      let workerCalled = false;
      const worker = createWorkers([{
        handle: function* handle() {
          workerCalled = true;
          return true;
        },
        validate: () => {
          validatorCalled = true;
          throw new Error('validator error test');
        },
        routingKey
      }], {
        workerName,
        amqpUrl,
        exchangeName,
        queueName
      }, {
        processExitTimeout: 5000,
        logger
      });
      yield worker.listen();
      channel.publish(exchangeName, routingKey, new Buffer(JSON.stringify(messageContent2)));
      yield cb => setTimeout(cb, 100);
      expect(validatorCalled).to.be.true();
      expect(workerCalled).to.be.false();
      expect(logger.warn.called).to.be.true();
      yield worker.close(false);
      const message = yield channel.get(formattedQueueName);
      expect(message).to.be.false();
    });

    it('should not call handler and fail if validator throws (legacy)', function* test() {
      sandbox.spy(logger, 'warn');
      let validatorCalled = false;
      let workerCalled = false;
      const worker = createWorkers([{
        handle: function* handle() {
          workerCalled = true;
          return true;
        },
        validate: () => {
          validatorCalled = true;
          throw new Error('validator error test');
        },
        routingKey
      }], {
        workerName,
        amqpUrl,
        exchangeName,
        queueName
      }, {
        processExitTimeout: 5000,
        logger
      });
      yield worker.listen();
      channel.publish(exchangeName, routingKey, new Buffer(JSON.stringify(messageContent2)));
      yield cb => setTimeout(cb, 100);
      expect(validatorCalled).to.be.true();
      expect(workerCalled).to.be.false();
      expect(logger.warn.called).to.be.true();
      yield worker.close(false);
      const message = yield channel.get(formattedQueueName);
      expect(message).to.be.false();
    });

    it('should call provided handler and ack if handler runs ok', function* test() {
      let workerCalled = false;
      const worker = createWorkers(
        [{
          handle: function* handle() {
            workerCalled = true;
            return true;
          },
          validate: _.identity,
          routingKey
        }],
        {
          workerName,
          amqpUrl,
          exchangeName,
          queueName
        }, { logger }
      );
      yield worker.listen();
      channel.publish(exchangeName, routingKey, new Buffer(JSON.stringify(messageContent2)));
      yield cb => setTimeout(cb, 100);
      expect(workerCalled).to.be.true();
      yield worker.close(false);
      const message = yield channel.get(formattedQueueName);
      expect(message).to.be.false();
    });

    it('should call provided handlers and ack if handlers runs ok', function* test() {
      let worker1CallParameter = false;
      let worker2CallParameter = false;
      const routingKey2 = `${routingKey}_2`;
      const worker = createWorkers(
        [{
          handle: function* handle(content) {
            worker1CallParameter = content;
            return true;
          },
          validate: _.noop,
          routingKey
        }, {
          handle: function* handle(content) {
            worker2CallParameter = content;
            return true;
          },
          validate: () => ({ validated: true }),
          routingKey: routingKey2
        }],
        {
          workerName,
          amqpUrl,
          exchangeName,
          queueName
        },
        {
          logger
        }
      );
      yield worker.listen();
      channel.publish(exchangeName, routingKey, new Buffer(JSON.stringify(messageContent2)));
      channel.publish(exchangeName, routingKey2, new Buffer(JSON.stringify(messageContent2)));
      yield cb => setTimeout(cb, 100);
      expect(worker1CallParameter).to.deep.equal(messageContent2);
      expect(worker2CallParameter).to.deep.equal({ validated: true });
      yield worker.close(false);
      const message = yield channel.get(formattedQueueName);
      expect(message).to.be.false();
    });

    it('should perform url resolution correctly', function* test() {
      const connectStub = sandbox.spy(amqplib, 'connect');
      const worker = createWorkers([{
        handle: () => null,
        validate: _.identity,
        routingKey
      }], {
        workerName,
        amqpUrl,
        exchangeName,
        queueName
      }, { logger });
      yield worker.listen();
      yield worker.close(false);
      const url = connectStub.firstCall.args[0];
      expect(url).to.equal('amqp://guest:guest@localhost:5672?heartbeat=10');
    });

    it('should retry to handle message once on error catched', function* test() {
      const handlerStub = sandbox.stub();
      sandbox.spy(logger, 'warn');
      handlerStub.onFirstCall().throws();
      handlerStub.onSecondCall().returns(true);
      const worker = createWorkers([{
        handle: handlerStub,
        validate: _.identity,
        routingKey
      }], {
        workerName,
        amqpUrl,
        exchangeName,
        queueName
      }, { logger });
      yield worker.listen();
      channel.publish(exchangeName, routingKey, new Buffer(JSON.stringify(messageContent2)));
      yield cb => setTimeout(cb, 100);
      yield worker.close(false);
      expect(logger.warn.calledWithMatch(
        { workerName },
        '[worker#listen] Message handler failed to process message #1 - retrying one time')
      ).to.be.true();
      const message = yield channel.get(formattedQueueName);
      expect(message).to.be.false();
    });

    it('should fail and ack message if handler fails two times on same message', function* test() {
      const handlerStub = sandbox.stub();
      sandbox.spy(logger, 'warn');
      sandbox.spy(logger, 'error');
      handlerStub.throws();
      const worker = createWorkers([{
        handle: handlerStub,
        validate: _.identity,
        routingKey
      }], {
        workerName,
        amqpUrl,
        exchangeName,
        queueName
      }, { logger });
      yield worker.listen();
      channel.publish(exchangeName, routingKey, new Buffer(JSON.stringify(messageContent2)));
      yield cb => setTimeout(cb, 100);
      yield worker.close(false);
      expect(logger.warn.calledWithMatch(
        { workerName },
        '[worker#listen] Message handler failed to process message #1 - retrying one time')
      ).to.be.true();
      expect(logger.error.calledWithMatch(
        { workerName },
        '[worker#listen] Consumer handler failed to process message #2 - discard message and fail')
      ).to.be.true();
      const message = yield channel.get(formattedQueueName);
      expect(message).to.be.false();
    });
  });

  describe('forceExit parameter setting', () => {
    it('should forcefully exit process on worker close', function* test() {
      sandbox.stub(process, 'exit');
      const worker = createWorkers([{
        handle: _.identity,
        validate: _.identity,
        routingKey
      }],
        {
          workerName,
          amqpUrl,
          exchangeName,
          queueName
        }, {
          processExitTimeout: 1,
          logger
        });
      yield worker.listen();
      yield worker.close();
      yield cb => setTimeout(cb, 500);
      expect(process.exit.called).to.be.true();
    });
  });

  describe('events', () => {
    let connectionMock;
    let channelMock;
    let connectionStub; // eslint-disable-line no-unused-vars

    beforeEach(function* beforeEach() {
      channelMock = new ChannelStub();
      connectionMock = new ConnectionStub(channelMock);

      connectionStub = sandbox
        .stub(amqplib, 'connect')
        .returns(new Promise(resolve => resolve(connectionMock)));

      sandbox.spy(logger, 'info');
      sandbox.spy(logger, 'warn');
      sandbox.spy(logger, 'error');

      const worker = createWorkers([{
        handle: _.identity,
        validate: _.identity,
        routingKey
      }], {
        workerName,
        amqpUrl,
        exchangeName,
        queueName
      }, { logger });

      yield worker.listen();
    });

    describe('#subscribeToConnectionEvents', () => {
      it('should log if connection is blocked', function* test() {
        connectionMock.emit('blocked');
        expect(logger.warn.calledWithMatch(
          { workerName }, '[AMQP] Connection blocked')
        ).to.be.true();
      });

      it('should log if connection is closing', function* test() {
        connectionMock.emit('close');
        expect(logger.info.calledWithMatch(
          { workerName }, '[AMQP] Connection closing, exiting')
        ).to.be.true();
      });

      it('should log if connection is in error', function* test() {
        connectionMock.emit('error');
        expect(logger.error.calledWithMatch(
          { workerName }, '[AMQP] Connection closing because of an error')
        ).to.be.true();
      });
    });

    describe('#subscribeToChannelEvents', () => {
      it('should log if channel is closed', function* test() {
        channelMock.emit('close');
        expect(logger.info.calledWithMatch(
          { workerName }, '[AMQP] channel closed')
        ).to.be.true();
      });

      it('should log if channel is in error', function* test() {
        channelMock.emit('error');
        expect(logger.error.calledWithMatch(
          { workerName }, '[AMQP] channel error')
        ).to.be.true();
      });
    });
  });
});
