'use strict';

/**
 * Consumer type that returns the handler result or retries the message in case of error.
 *
 * @param {function} handler the message handler
 * @param {object} logger the logger
 * @returns {boolean} the handler result
 */
function* handlerResult(handler, logger) {
  try {
    return yield handler();
  } catch (err) {
    logger.error(
      { err },
      '[worker#handlerResult] Error handling message, retrying'
    );
    return false;
  }
}

module.exports = {
  handlerResult
};
