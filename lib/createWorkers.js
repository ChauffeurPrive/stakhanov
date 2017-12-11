'use strict';

const EventEmitter = require('events');
const _ = require('lodash');
const co = require('co');
const url = require('url');
const amqplib = require('amqplib');

const { promisifyWithTimeout } = require('./lib');
const { applyConfiguration, applyOptions } = require('./schema/createWorkers.schema');

const DEFAULT_EXCHANGE_TYPE = 'topic';

// constants for events
const TASK_COMPLETED = 'task.completed';
const TASK_RETRIED = 'task.retried';
const TASK_FAILED = 'task.failed';
const WORKER_CLOSED = 'task.closed';

/**
 * @typedef Logger
 *
 * @param {function} debug
 * @param {function} info
 * @param {function} warn
 * @param {function} error
 */

/**
 * Create a worker instance based on configuration
 * @param {Array} handlers array of handlers to handle each message
 * @param {function} handlers.handle function to handle each message
 * @param {function} handlers.validate function to validate each message body
 * @param {String} handlers.routingKey name of the routing key to bind to
 * @param {Object} config configuration for the worker
 * @param {String} config.workerName name for the worker
 * @param {String} config.amqpUrl url to amqp server
 * @param {String} config.exchangeName name of the exchange to use
 * @param {String} config.queueName name of the queue to listen on
 * @param {Object} [options] additional options
 * @param {Number} [options.heartbeat] to override default heartbeat
 * @param {Number} [options.taskTimeout] to override default task timeout
 * @param {Number} [options.processExitTimeout] to override default process exit timeout
 * @param {Number} [options.channelPrefetch] to override default channel prefetch value
 * @param {Logger} [options.logger] to receive logs from the worker
 * @returns {Object} a worker instance with connection, channel, and listen/close functions
 */
function createWorkers(handlers, config, options = {}) {
  const emitter = new EventEmitter();
  const workerConfig = applyConfiguration(Object.assign({}, { handlers }, config));
  const workerOptions = applyOptions(options);
  const configuration = Object.assign({}, workerConfig, workerOptions);
  const configWithoutFuncs = _.omit(configuration, ['amqpUrl', 'handlers', 'validator', 'logger']);
  configWithoutFuncs.routingKeys = _.map(handlers, 'routingKey');

  let workerConnection;
  const workerChannels = [];
  const logger = configuration.logger;

  return {
    listen: co.wrap(_listen),
    close: co.wrap(_close),
    wait: _wait,
    TASK_COMPLETED,
    TASK_RETRIED,
    TASK_FAILED,
    WORKER_CLOSED
  };

  /**
   * Wait for an event for a given amount of time.
   *
   * @param {string} eventName The name of the event to wait for.
   * @param {number} timeout The maximum number of milliseconds to wait for, defaults to 1000.
   * @return {Promise} A promise which is resolved when the event emitted, or rejected
   * if the timeout occurs first.
   * @private
   */
  function _wait(eventName, timeout = 1000) {
    return new Promise((resolve, reject) => {
      let timeoutId = null;

      timeoutId = setTimeout(() => {
        timeoutId = null;
        reject(new Error(`event ${eventName} didn't occur after ${timeout}ms`));
      }, timeout);

      emitter.once(eventName, () => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          resolve();
        }
      });
    });
  }

  /**
   * Emit an event with the provided name.
   *
   * Emission is scheduled with process.nextTick to allow current work to complete.
   *
   * @param {string} eventName the name of the event to publish
   * @returns {void}
   */
  function _emit(eventName) {
    process.nextTick(() => emitter.emit(eventName));
  }

  /**
   * Exits the process after having emitted the worker close event.
   * @returns {void}
   */
  function* _exit() {
    _emit('worker.closed');
    yield cb => setTimeout(cb, configuration.processExitTimeout);
    process.exit(0);
  }

  /**
   * Listen to the queue and consume any matching message posted
   * @throws if validator generates an error
   * @returns {*} -
   * @private
   */
  function* _listen() {
    workerConnection = yield _connectAmqp(configuration);
    logger.info(
      { options: configWithoutFuncs, workerName: configuration.workerName },
      '[worker#listen] worker started'
    );
    yield configuration.handlers.map(handler => _bindHandler(handler));
  }

  /**
   * Close the connection
   * @param {Boolean} forceExit if true (default), will force a process exit after
   * configured timeout
   * @returns {*} -
   * @private
   */
  function* _close(forceExit = true) {
    logger.info(
      { options: configWithoutFuncs, workerName: configuration.workerName, forceExit },
      '[worker#close] Shutting down'
    );
    yield workerChannels.map(channel => channel.close());
    if (workerConnection) yield workerConnection.close(forceExit);
    if (forceExit) yield _exit();
  }

  /**
   * Create an AMQP message consumer with the given handler
   *
   * @param {Object} channel The AMQP channel.
   * @param {function} handle the message handler
   * @param {function} validate the message validator
   * @returns {function} The generator function that consumes an AMQP message
   * @private
   */
  function _getMessageConsumer(channel, handle, validate) {
    return function* _consumeMessage(message) {
      logger.debug({ message }, '[worker#listen] received message');

      const content = _parseMessage(message);
      if (!content) return channel.ack(message);

      const validatedContent = _validateMessage(validate, content);
      if (_.isError(validatedContent)) return channel.ack(message);

      const handleSuccess = yield _handleMessage(
        handle,
        validatedContent || content,
        message.fields
      );
      if (!handleSuccess) return channel.nack(message);
      return channel.ack(message);
    };
  }

  /**
   * Parse a message and return content
   *
   * @param {Object} message the message from the queue
   * @returns {String|null} message content or null if parsing failed
   * @private
   */
  function _parseMessage(message) {
    try {
      const contentString = message && message.content && message.content.toString();
      return JSON.parse(contentString);
    } catch (err) {
      _emit('task.failed');
      logger.warn(
        { err, message, options: configWithoutFuncs },
        '[worker#listen] Content is not a valid JSON'
      );
      return null;
    }
  }

  /**
   * Validate a message against custom validator if any
   *
   * @param {function} validate the message validator
   * @param {String} message content of the message
   * @returns {Object|null} The validated object, or null if validation failed
   * @private
   */
  function _validateMessage(validate, message) {
    const { workerName } = configuration;
    try {
      return validate(message);
    } catch (err) {
      _emit('task.failed');
      logger.warn(
        { err, message, options: configWithoutFuncs, workerName },
        '[worker#listen] Message validation failed'
      );
      return err;
    }
  }

  /**
   * Perform message handling
   *
   * @param {function} handler message handler
   * @param {String} content message content
   * @param {Object} fields message additional fields (including 'redelivered')
   * @returns {boolean} true if message should be acked, false if it should be nacked
   * @private
   */
  function* _handleMessage(handler, content, fields) {
    const { workerName, taskTimeout } = configuration;
    try {
      yield promisifyWithTimeout(handler(content, fields), workerName, taskTimeout);
      _emit('task.completed');
      return true;
    } catch (err) {
      if (!fields.redelivered) {
        logger.warn(
          { err, content, options: configWithoutFuncs, workerName },
          '[worker#listen] Message handler failed to process message #1 - retrying one time'
        );
        _emit('task.retried');
        return false;
      }
      logger.error(
        { err, content, options: configWithoutFuncs, workerName },
        '[worker#listen] Consumer handler failed to process message #2 - discard message and fail'
      );
      _emit('task.failed');
      return true;
    }
  }

  /**
   * Bind a logger to noticeable connection events
   * @param {Object} connection the connection objext
   * @param {String} workerName worker name
   * @returns {*} -
   * @private
   */
  function _subscribeToConnectionEvents(connection, workerName) {
    connection.on('close', forceExit => {
      logger.info({ workerName, forceExit }, '[AMQP] Connection closing, exiting');
    });
    connection.on('error', err => {
      logger.error({ err, workerName }, '[AMQP] Connection closing because of an error');
    });
    connection.on('blocked', reason => {
      logger.warn({ reason, workerName }, '[AMQP] Connection blocked');
    });
  }

  /**
   * Try to open a connection to an AMQP server
   * http://www.squaremobius.net/amqp.node/channel_api.html#connect
   * @param {Object} options The option for the AMQP connection
   * @param {String} options.amqpUrl the url to the server (ex: 'amqp://localhost')
   * @param {String} options.workerName the name of the worker (for logs)
   * @param {Number} options.heartbeat the period of the connection heartbeat, in seconds
   * @param {Object} socketOptions the options that will be passed to the socket
   * library (net or tls).
   * @returns {Object} connection object
   * @throws if connection fails
   * @private
   */
  function* _connectAmqp({ amqpUrl, workerName, heartbeat }, socketOptions = {}) {
    try {
      const urlWithParam = url.resolve(amqpUrl, `?heartbeat=${heartbeat}`);
      const connection = yield amqplib.connect(urlWithParam, socketOptions);
      logger.info({ workerName, heartbeat }, '[AMQP] connected to server');
      _subscribeToConnectionEvents(connection, workerName);
      return connection;
    } catch (err) {
      logger.error(
        { err, heartbeat, socketOptions, workerName },
        '[worker#_connectAmqp] connection failed'
      );
      throw err;
    }
  }

  /**
   * Bind a logger to noticeable channel events
   * @param {Object} channel the channel object
   * @param {String} exchangeName the exchange name to use
   * @param {String} queueName the queue name to target
   * @param {Number} channelPrefetch number of message to prefetch from channel
   * @param {String} workerName the name of the worker (for logs)
   * @returns {*} -
   * @private
   */
  function _subscribeToChannelEvents(channel,
    { exchangeName, queueName, channelPrefetch, workerName }) {
    channel.on('error', err => {
      logger.error(
        { err, exchangeName, queueName, channelPrefetch, workerName },
        '[AMQP] channel error'
      );
    });
    channel.on('close', () => {
      logger.info(
        { exchangeName, queueName, channelPrefetch, workerName },
        '[AMQP] channel closed'
      );
    });
  }

  /**
   * Create a channel for the worker
   * @param {Object} connection the connection object
   * @param {String} exchangeName the exchange name to use
   * @param {String} queueName the queue name to target
   * @param {String} routingKey routing key to bind on
   * @param {Number} channelPrefetch number of message to prefetch from channel
   * @param {String} workerName the name of the worker (for logs)
   * @returns {Object} channel object
   * @private
   */
  function* _createChannel(connection,
    { exchangeName, queueName, channelPrefetch, workerName }) {
    const channel = yield connection.createChannel();
    logger.info(
      { exchangeName, queueName, channelPrefetch, workerName },
      '[AMQP] create channel'
    );
    _subscribeToChannelEvents(
      channel,
      { exchangeName, queueName, channelPrefetch, workerName }
    );
    yield channel.prefetch(channelPrefetch);
    yield channel.assertExchange(exchangeName, DEFAULT_EXCHANGE_TYPE);
    yield channel.assertQueue(queueName, {});
    return channel;
  }


/**
 * Bind a message handler on a queue to consume
 * @param   {Object} handler the handler content
 * @param   {function} handler.handle the message handler
 * @param   {function} handler.validate the message validator
 * @param   {String} handler.routingKey the routingKey to bind to
 * @returns {*} -
 * @private
 */
  function* _bindHandler({ routingKey, handle, validate }) {
    const { exchangeName, queueName, channelPrefetch, workerName } = configuration;
    const formattedQueueName = _getQueueName(queueName, routingKey);

    const workerChannel = yield _createChannel(workerConnection, {
      exchangeName,
      queueName: formattedQueueName,
      channelPrefetch,
      workerName
    });
    workerChannels.push(workerChannel);

    yield workerChannel.bindQueue(formattedQueueName, exchangeName, routingKey);
    yield workerChannel.consume(
      formattedQueueName,
      co.wrap(_getMessageConsumer(workerChannel, handle, validate))
    );
  }
}

/**
 * Returns the formatted queue name.
 *
 * It contains the base queue name and the routing key.
 *
 * @param       {String} queueName The base queue name.
 * @param       {String} routingKey The routing key.
 * @returns     {String} The formatted queue name.
 */
function _getQueueName(queueName, routingKey) {
  return `${queueName}.${routingKey}`;
}

module.exports = {
  createWorkers
};
