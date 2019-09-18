'use strict';

/**
 * Consumer type that retries indefinitely until success to handle the message.
 *
 * @param {function} handler the message handler
 * @param {object} logger the logger
 * @returns {boolean} the handler result
 */
function* infinite(handler, logger) {
  try {
    yield handler();
    return true;
  } catch (err) {
    logger.error(
      { err },
      '[worker#infinite] Error handling message, retrying'
    );
    return false;
  }
}

module.exports = {
  infinite
};
