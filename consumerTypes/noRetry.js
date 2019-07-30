'use strict';

/**
 * Consumer type that drops the message after the 1st handling error.
 *
 * @param {function} handler the message handler
 * @param {object} logger the logger
 * @returns {boolean} the handler result
 */
function* noRetry(handler, logger) {
  try {
    yield handler();
  } catch (err) {
    logger.error(
      { err },
      '[worker#noRetry] Error handling message, dropping'
    );
  }
  return true;
}

module.exports = {
  noRetry
};
