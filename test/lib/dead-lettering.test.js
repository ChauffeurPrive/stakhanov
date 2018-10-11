'use strict';

const _ = require('lodash');
const { expect } = require('chai');
const sinon = require('sinon');
const amqplib = require('amqplib');

const { createWorkers } = require('../../lib/createWorkers');

const amqpUrl = 'amqp://guest:guest@localhost:5672';

describe('Dead lettering', () => {
  const sandbox = sinon.sandbox.create();

  let connection;
  let channel;

  const mainWorkerName = 'dead letter main worker';
  const mainQueueName = 'dl.main.queue.name';
  const mainExchangeName = 'dl.main.exchange.name';
  const mainRoutingKey = 'dl.main.routingKey';
  const formattedMainQueueName = `${mainQueueName}.${mainRoutingKey}`;

  const secondaryWorkerName = 'dead letter secondary worker';
  const secondaryExchangeName = 'dl.secondary.queue.name';
  const secondaryQueueName = 'dl.secondary.queue.name';
  const formattedSecondaryQueueName = `${secondaryQueueName}.${mainRoutingKey}`;

  const messageContent = { test: 'message' };

  const logger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  };

  before(function* before() {
    connection = yield amqplib.connect(amqpUrl);
    channel = yield connection.createChannel();
    yield channel.deleteQueue(formattedMainQueueName);
    yield channel.deleteQueue(formattedSecondaryQueueName);
  });

  beforeEach(function* beforeEach() {
    yield channel.assertExchange(mainExchangeName, 'topic');
    yield channel.assertExchange(secondaryExchangeName, 'topic');
  });

  afterEach(() => {
    sandbox.restore();
  });

  after(function* after() {
    yield channel.deleteQueue(formattedMainQueueName);
    yield channel.deleteExchange(mainExchangeName);
    yield channel.deleteQueue(formattedSecondaryQueueName);
    yield channel.deleteExchange(secondaryExchangeName);
    yield connection.close();
  });

  it('should fail 2 times on the main queue then publish ' +
    'on the dead letter queue and succeed', function* test() {
    sandbox.spy(logger, 'warn');
    sandbox.spy(logger, 'error');
    const firstHandlerStub = sandbox.stub();
    firstHandlerStub.throws();
    const firstWorker = createWorkers([{
      handle: firstHandlerStub,
      validate: _.identity,
      routingKey: mainRoutingKey
    }], {
      workerName: mainWorkerName,
      amqpUrl,
      exchangeName: mainExchangeName,
      queueName: mainQueueName,
      queueOptions: {
        deadLetterExchange: secondaryExchangeName
      }
    }, {
      channelCloseTimeout: 1,
      logger
    });

    const dlqHandlerStub = sandbox.stub();
    dlqHandlerStub.returns(Promise.resolve(true));
    const dlqWorker = createWorkers([{
      handle: dlqHandlerStub,
      validate: _.identity,
      routingKey: mainRoutingKey
    }], {
      workerName: secondaryWorkerName,
      amqpUrl,
      exchangeName: secondaryExchangeName,
      queueName: secondaryQueueName
    }, {
      channelCloseTimeout: 1,
      logger
    });
    yield dlqWorker.listen();
    yield firstWorker.listen();

    channel.publish(
      mainExchangeName,
      mainRoutingKey,
      new Buffer(JSON.stringify(messageContent))
    );
    yield firstWorker.wait('task.retried');
    yield firstWorker.wait('task.failed');
    yield dlqWorker.wait('task.completed');
    yield dlqWorker.close(false);
    yield firstWorker.close(false);

    expect(logger.warn.calledWithMatch(
      { workerName: mainWorkerName },
      '[worker#listen] Message handler failed to process message #1 - retrying one time')
    ).to.be.true();
    expect(logger.error.calledWithMatch(
      { workerName: mainWorkerName },
      '[worker#listen] Consumer handler failed to process message #2 - discard message and fail')
    ).to.be.true();
    const mainMessage = yield channel.get(formattedMainQueueName);
    expect(mainMessage).to.be.false();
    expect(firstHandlerStub).to.have.been.called(2);

    const secondaryMessage = yield channel.get(formattedSecondaryQueueName);
    expect(secondaryMessage).to.be.false();
    expect(dlqHandlerStub).to.have.been.called(1);
  });
});
