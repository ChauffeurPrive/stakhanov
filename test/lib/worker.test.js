'use strict';

const _ = require('lodash');
const { expect } = require('chai');
const sinon = require('sinon');
const amqplib = require('amqplib');
const EventEmitter = require('events');

const { createWorkers } = require('../../lib/createWorkers');
const consumers = require('../../consumerTypes');

const amqpUrl = 'amqp://guest:guest@localhost:5672';

class ChannelStub extends EventEmitter {
  * prefetch() {} // eslint-disable-line no-empty-function
  * assertExchange() {} // eslint-disable-line no-empty-function
  * assertQueue() {} // eslint-disable-line no-empty-function
  * bindQueue() {} // eslint-disable-line no-empty-function
  * consume() { return { consumerTag: 'some-tag' }; }
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
    error: () => null,
    child: () => logger
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
    // yield channel.deleteQueue(formattedQueueName);
    // yield channel.deleteExchange(exchangeName);
    yield connection.close();
  });

  describe('#wait', () => {
    it('should throw an error after the specified timeout', function* test() {
      const worker = createWorkers([{
        consumer: consumers.noRetry,
        handle: () => true,
        validate: _.identity,
        routingKey
      }], {
        workerName,
        amqpUrl,
        exchangeName,
        queueName
      });
      let err = null;
      try {
        yield worker.wait('kk', 10);
      } catch (e) {
        err = e;
      }
      expect(err).to.exist();
      expect(err.toString()).to.equal('Error: event kk didn\'t occur after 10ms');
      yield worker.close(false);
    });

    it('should not resolve the promise when the event occurs after the timeout', function* test() {
      const worker = createWorkers(
        [{
          consumer: consumers.noRetry,
          handle: () => true,
          validate: _.identity,
          routingKey
        }],
        {
          workerName,
          amqpUrl,
          exchangeName,
          queueName
        }
      );
      yield worker.listen();

      // store the promise for later to check that it's not
      // modified on the event completion
      const promise = worker.wait('task.completed', 0);

      let err = null;
      try {
        yield promise;
      } catch (e) {
        err = e;
      }
      expect(err).to.exist();

      channel.publish(exchangeName, routingKey, new Buffer(JSON.stringify(messageContent2)));
      yield worker.wait('task.completed');

      // check that the previously generated promise wasn't affected by the completion of the event
      // after the timeout
      err = null;
      try {
        yield promise;
      } catch (e) {
        err = e;
      }
      expect(err).to.exist();
      expect(err.toString()).to.equal('Error: event task.completed didn\'t occur after 0ms');
      yield worker.close(false);
    });
  });

  describe('#listening', () => {
    it('should log an error and throw if connection fails', function* test() {
      sandbox.stub(amqplib, 'connect').throws();
      sandbox.spy(logger, 'error');
      let error;
      let worker;
      try {
        worker = createWorkers([{
          consumer: consumers.noRetry,
          handle: () => true,
          validate: _.identity,
          routingKey
        }], {
          workerName,
          amqpUrl,
          exchangeName,
          queueName
        }, {
          channelCloseTimeout: 1,
          logger
        });
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
        consumer: consumers.noRetry,
        handle: () => true,
        validate: _.identity,
        routingKey
      }], {
        workerName,
        amqpUrl,
        exchangeName,
        queueName
      }, {
        channelCloseTimeout: 1,
        logger
      });
      yield worker.listen();
      channel.publish(exchangeName, routingKey, new Buffer('test'));
      yield worker.wait('task.failed');
      expect(logger.warn).to.have.callCount(1);
      yield worker.close(false);
    });

    it('should call message validation if provided', function* test() {
      let validatorCalled = false;
      let workerCalled = false;
      const worker = createWorkers([{
        consumer: consumers.noRetry,
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
      }, {
        channelCloseTimeout: 1
      });
      yield worker.listen();
      channel.publish(exchangeName, routingKey, new Buffer(JSON.stringify(messageContent)));
      yield worker.wait('task.completed');
      expect(validatorCalled).to.be.true();
      expect(workerCalled).to.be.true();
      yield worker.close(false);
    });

    it('should not call handler and fail if validator throws', function* test() {
      sandbox.spy(logger, 'warn');
      let validatorCalled = false;
      let workerCalled = false;
      const worker = createWorkers([{
        consumer: consumers.noRetry,
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
        channelCloseTimeout: 1,
        logger
      });
      yield worker.listen();
      channel.publish(exchangeName, routingKey, new Buffer(JSON.stringify(messageContent2)));
      yield worker.wait('task.failed');
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
          consumer: consumers.noRetry,
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
        }, {
          channelCloseTimeout: 1,
          logger
        }
      );
      yield worker.listen();
      channel.publish(exchangeName, routingKey, new Buffer(JSON.stringify(messageContent2)));
      yield worker.wait('task.completed');
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
          consumer: consumers.noRetry,
          handle: function* handle(content) {
            worker1CallParameter = content;
            return true;
          },
          validate: _.noop,
          routingKey
        }, {
          consumer: consumers.noRetry,
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
        }, {
          channelCloseTimeout: 1,
          logger
        }
      );
      yield worker.listen();
      channel.publish(exchangeName, routingKey, new Buffer(JSON.stringify(messageContent2)));
      channel.publish(exchangeName, routingKey2, new Buffer(JSON.stringify(messageContent2)));
      while (!(worker1CallParameter && worker2CallParameter)) {
        yield worker.wait('task.completed');
      }
      expect(worker1CallParameter).to.deep.equal(messageContent2);
      expect(worker2CallParameter).to.deep.equal({ validated: true });
      yield worker.close(false);
      const message = yield channel.get(formattedQueueName);
      expect(message).to.be.false();
    });

    it('should perform url resolution correctly', function* test() {
      const connectStub = sandbox.spy(amqplib, 'connect');
      const worker = createWorkers([{
        consumer: consumers.noRetry,
        handle: () => null,
        validate: _.identity,
        routingKey
      }], {
        workerName,
        amqpUrl,
        exchangeName,
        queueName
      }, {
        channelCloseTimeout: 1,
        logger
      });
      yield worker.listen();
      yield worker.close(false);
      const url = connectStub.firstCall.args[0];
      expect(url).to.equal('amqp://guest:guest@localhost:5672?heartbeat=10');
    });

    it('should retry to handle message if consumer type failed and retried', function* test() {
      const handlerStub = sandbox.stub();
      handlerStub.onFirstCall().throws();
      handlerStub.onSecondCall().returns(true);
      const worker = createWorkers([{
        consumer: consumers.retryOnce,
        handle: handlerStub,
        validate: _.identity,
        routingKey
      }], {
        workerName,
        amqpUrl,
        exchangeName,
        queueName
      }, {
        channelCloseTimeout: 1,
        logger
      });
      yield worker.listen();
      channel.publish(exchangeName, routingKey, new Buffer(JSON.stringify(messageContent2)));
      yield worker.wait('task.failed');
      yield worker.wait('task.completed');
      yield worker.close(false);
      const message = yield channel.get(formattedQueueName);
      expect(message).to.be.false();
    });

    it('should set the prefetch parameter', function* test() {
      const channelMock = new ChannelStub();
      const prefetchStub = sandbox.stub(channelMock, 'prefetch')
        .returns(Promise.resolve());
      const connectionMock = new ConnectionStub(channelMock);

      const connectionStub = sandbox
        .stub(amqplib, 'connect')
        .returns(new Promise(resolve => resolve(connectionMock)));

      const worker = createWorkers([{
        consumer: consumers.noRetry,
        handle: _.identity,
        validate: _.identity,
        routingKey
      }], {
        workerName,
        amqpUrl,
        exchangeName,
        queueName
      }, {
        channelPrefetch: 50
      });

      yield worker.listen();

      expect(connectionStub.callCount).to.equal(1);
      expect(prefetchStub.args).to.deep.equal([
        [50]
      ]);
    });
  });

  describe('#close', () => {
    let exitStub;
    beforeEach(() => {
      // without this, mocha will stop at the end of the test
      process.removeAllListeners('SIGTERM');
      process.removeAllListeners('SIGINT');
      exitStub = sandbox.stub(process, 'exit');
      sandbox.spy(logger, 'error');
    });

    it('should forcefully exit process on worker close (forceExit=true)', function* test() {
      const worker = createWorkers([{
        consumer: consumers.noRetry,
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
          channelCloseTimeout: 1,
          processExitTimeout: 1,
          logger
        });
      yield worker.listen();
      yield worker.close();
      expect(exitStub.args).to.deep.equal([
        [0]
      ]);
    });

    it('should not exit process on worker close (forceExit=false)', function* test() {
      const worker = createWorkers([{
        consumer: consumers.noRetry,
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
          channelCloseTimeout: 1,
          processExitTimeout: 1,
          logger
        });
      yield worker.listen();
      yield worker.close(false);
      expect(exitStub.args).to.deep.equal([]);
    });

    it('should not throw an error when channels close fails', function* test() {
      const channelMock = new ChannelStub();
      const connectionMock = new ConnectionStub(channelMock);
      sandbox
        .stub(amqplib, 'connect')
        .returns(Promise.resolve(connectionMock));

      channelMock.cancel = sandbox.stub().throws(new Error('Channel cancel failure test'));
      connectionMock.close = sandbox.stub().returns(Promise.resolve(true));

      const worker = createWorkers([
        {
          consumer: consumers.noRetry,
          handle: _.identity,
          validate: _.identity,
          routingKey
        },
        {
          consumer: consumers.noRetry,
          handle: _.identity,
          validate: _.identity,
          routingKey: 'test.something_else_happened'
        }],
        {
          workerName,
          amqpUrl,
          exchangeName,
          queueName
        }, {
          channelCloseTimeout: 1,
          processExitTimeout: 1,
          logger
        });

      yield worker.listen();

      let closeError;
      try {
        yield worker.close(true);
      } catch (error) {
        closeError = error;
      }

      expect(closeError).to.equal(undefined);
    });

    it('should not throw an error when worker connection close fails', function* test() {
      const channelMock = new ChannelStub();
      const connectionMock = new ConnectionStub(channelMock);
      sandbox
        .stub(amqplib, 'connect')
        .returns(Promise.resolve(connectionMock));

      channelMock.cancel = sandbox.stub().returns(Promise.resolve(true));
      connectionMock.close = sandbox.stub().throws(
        new Error('Worker connection close failure test')
      );

      const worker = createWorkers([{
        consumer: consumers.noRetry,
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
          channelCloseTimeout: 1,
          processExitTimeout: 1,
          logger
        });

      yield worker.listen();

      let closeError;
      try {
        yield worker.close(true);
      } catch (error) {
        closeError = error;
      }

      expect(closeError).to.equal(undefined);
    });

    it('should be idempotent (can be safely called twice)', function* test() {
      const worker = createWorkers([{
        consumer: consumers.noRetry,
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
          channelCloseTimeout: 1,
          processExitTimeout: 1,
          logger
        });
      yield worker.listen();
      yield worker.close();
      yield worker.close();
      expect(exitStub.args).to.deep.equal([
        [0]
      ]);
    });

    it('should finish handling current messages before closing a channel', function* test() {
      const handlerStub = sandbox.stub()
        .returns(() => new Promise(resolve => setTimeout(resolve, 20)));
      const worker = createWorkers([{
        consumer: consumers.noRetry,
        handle: handlerStub,
        validate: _.identity,
        routingKey
      }],
        {
          workerName,
          amqpUrl,
          exchangeName,
          queueName
        }, {
          channelCloseTimeout: 50,
          processExitTimeout: 1,
          logger
        });
      yield worker.listen();
      const message = new Buffer(JSON.stringify({ hello: 'world' }));
      channel.publish(exchangeName, routingKey, message);
      yield cb => setTimeout(cb, 10);
      yield worker.close(false);

      const remainingMessage = yield channel.get(formattedQueueName);
      expect(remainingMessage).to.equal(false);

      expect(handlerStub.args.map(arg => arg[0])).to.deep.equal([
        { hello: 'world' }
      ]);
    });

    it('should nack unfinished messages if the close timeout is over', function* test() {
      const handlerStub = sandbox.stub()
        .returns(() => new Promise(resolve => setTimeout(resolve, 20)));
      const worker = createWorkers([{
        consumer: consumers.retryOnce,
        handle: handlerStub,
        validate: _.identity,
        routingKey
      }],
        {
          workerName,
          amqpUrl,
          exchangeName,
          queueName
        }, {
          channelCloseTimeout: 5,
          processExitTimeout: 1,
          logger
        });
      yield worker.listen();
      const message = new Buffer(JSON.stringify({ hello: 'world' }));
      channel.publish(exchangeName, routingKey, message);
      yield cb => setTimeout(cb, 10);
      yield worker.close(false);

      const remainingMessage = yield channel.get(formattedQueueName);
      expect(_.omit(remainingMessage, 'properties')).to.deep.equal({
        content: message,
        fields: {
          deliveryTag: 1,
          exchange: 'testexchange',
          messageCount: 0,
          redelivered: true,
          routingKey: 'test.something_happened'
        }
      });

      expect(handlerStub.args.map(arg => arg[0])).to.deep.equal([
        { hello: 'world' }
      ]);
    });

    it('should NOT be called on SIGINT if closeOnSignals is false', function* test() {
      const handlerDoneSpy = sandbox.spy();
      const handlerStub = sandbox.stub()
        .returns(() => new Promise(resolve => setTimeout(
          () => {
            handlerDoneSpy();
            resolve();
          },
          20)
        ));
      const worker = createWorkers([{
        consumer: consumers.noRetry,
        handle: handlerStub,
        validate: _.identity,
        routingKey
      }],
        {
          workerName,
          amqpUrl,
          exchangeName,
          queueName
        }, {
          channelCloseTimeout: 50,
          processExitTimeout: 1,
          logger
        });
      yield worker.listen();
      expect(process.listeners('SIGINT').map(fn => fn.name))
        .to.deep.equal([]);
      yield worker.close(false);
    });

    it('should be called on SIGINT if closeOnSignals is true', function* test() {
      const handlerDoneSpy = sandbox.spy();
      const handlerStub = sandbox.stub()
        .returns(() => new Promise(resolve => setTimeout(
          () => {
            handlerDoneSpy();
            resolve();
          },
          20)
        ));
      const worker = createWorkers([{
        consumer: consumers.noRetry,
        handle: handlerStub,
        validate: _.identity,
        routingKey
      }],
        {
          workerName,
          amqpUrl,
          exchangeName,
          queueName
        }, {
          channelCloseTimeout: 50,
          processExitTimeout: 1,
          closeOnSignals: true,
          logger
        });
      yield worker.listen();
      expect(process.listeners('SIGINT').map(fn => fn.name))
        .to.deep.equal(['onSignal']);
      const message = new Buffer(JSON.stringify({ hello: 'world' }));
      channel.publish(exchangeName, routingKey, message);
      yield cb => setTimeout(cb, 10);
      expect(handlerDoneSpy.callCount).to.equal(0);

      process.kill(process.pid, 'SIGINT');
      yield cb => setTimeout(cb, 60);

      // check the message has been processed and acked
      expect(handlerDoneSpy.callCount).to.equal(1);
      const remainingMessage = yield channel.get(formattedQueueName);
      expect(remainingMessage).to.equal(false);

      expect(handlerStub.args.map(arg => arg[0])).to.deep.equal([
        { hello: 'world' }
      ]);
      expect(exitStub).to.have.been.calledWith(0);
    });

    it('should be called on SIGTERM if closeOnSignals is true', function* test() {
      const handlerDoneSpy = sandbox.spy();
      const handlerStub = sandbox.stub()
        .returns(() => new Promise(resolve => setTimeout(
          () => {
            handlerDoneSpy();
            resolve();
          },
          20)
        ));
      const worker = createWorkers([{
        consumer: consumers.noRetry,
        handle: handlerStub,
        validate: _.identity,
        routingKey
      }],
        {
          workerName,
          amqpUrl,
          exchangeName,
          queueName
        }, {
          channelCloseTimeout: 50,
          processExitTimeout: 1,
          closeOnSignals: true,
          logger
        });
      yield worker.listen();
      expect(process.listeners('SIGTERM').map(fn => fn.name))
        .to.deep.equal(['onSignal']);
      const message = new Buffer(JSON.stringify({ hello: 'world' }));
      channel.publish(exchangeName, routingKey, message);
      yield cb => setTimeout(cb, 10);
      expect(handlerDoneSpy.callCount).to.equal(0);

      process.kill(process.pid, 'SIGTERM');
      yield cb => setTimeout(cb, 60);

      // check the message has been processed and acked
      expect(handlerDoneSpy.callCount).to.equal(1);
      const remainingMessage = yield channel.get(formattedQueueName);
      expect(remainingMessage).to.equal(false);

      expect(handlerStub.args.map(arg => arg[0])).to.deep.equal([
        { hello: 'world' }
      ]);
      expect(exitStub).to.have.been.calledWith(0);
    });
  });

  describe('events', () => {
    let connectionMock;
    let channelMock;
    let connectionStub; // eslint-disable-line no-unused-vars
    let exitStub;

    beforeEach(function* beforeEach() {
      channelMock = new ChannelStub();
      connectionMock = new ConnectionStub(channelMock);
      exitStub = sandbox.stub(process, 'exit');

      connectionStub = sandbox
        .stub(amqplib, 'connect')
        .returns(new Promise(resolve => resolve(connectionMock)));

      channelMock.cancel = sandbox.spy();

      connectionMock.close = sandbox.stub().returns(new Promise(resolve => resolve(true)));

      sandbox.spy(logger, 'info');
      sandbox.spy(logger, 'warn');
      sandbox.spy(logger, 'error');

      const worker = createWorkers([{
        consumer: consumers.noRetry,
        handle: _.identity,
        validate: _.identity,
        routingKey
      }], {
        workerName,
        amqpUrl,
        exchangeName,
        queueName
      }, {
        channelCloseTimeout: 10,
        processExitTimeout: 1,
        closeOnSignals: false,
        logger
      });

      yield worker.listen();
    });

    describe('#subscribeToConnectionEvents', () => {
      it('should log if connection is blocked', function* test() {
        connectionMock.emit('blocked');
        expect(logger.warn.calledWithMatch(
          { workerName }, '[AMQP] Connection blocked')
        ).to.be.true();
      });

      it('should log if connection is closing and exit', function* test() {
        connectionMock.emit('close');
        yield cb => setTimeout(cb, 20);
        expect(logger.info.calledWithMatch(
          { workerName }, '[AMQP] Connection closing, exiting')
        ).to.be.true();
        expect(channelMock.cancel.args).deep.equal([['some-tag']]);
        expect(connectionMock.close.args).deep.equal([]);
        expect(exitStub.args).deep.equal([[0]]);
      });

      it('should log if connection is in error', function* test() {
        connectionMock.emit('error');
        expect(logger.error.calledWithMatch(
          { workerName }, '[AMQP] Connection closing because of an error')
        ).to.be.true();
      });
    });

    describe('#subscribeToChannelEvents', () => {
      it('should log if channel is closed and exit', function* test() {
        channelMock.emit('close');
        yield cb => setTimeout(cb, 20);
        expect(logger.info.calledWithMatch(
          { workerName }, '[AMQP] channel closed')
        ).to.be.true();
        expect(channelMock.cancel.args).deep.equal([]);
        expect(connectionMock.close.args).deep.equal([[true]]);
        expect(exitStub.args).deep.equal([[0]]);
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
