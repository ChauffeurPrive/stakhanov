'use strict';

/**
 * Consumer type that retries to handle the message a second time after a
 * failure, but drops it after the second error.
 *
 * @param {function} handler the message handler
 * @param {object} logger the logger
 * @param {object} fields the AMQP message fields
 * @returns {boolean} the handler result
 */
function* retryOnce(handler, logger, fields) {
  try {
    yield handler();
    return true;
  } catch (err) {
    if (!fields.redelivered) {
      logger.warn(
        { err },
        '[worker#retryOnce] Message handler failed to process message #1 - retrying one time'
      );
      return false;
    }
    logger.error(
      { err },
      '[worker#retryOnce] Consumer handler failed to process message #2 - discard message and fail'
    );
    return true;
  }
}

module.exports = {
  retryOnce
};
