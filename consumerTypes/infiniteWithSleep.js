'use strict';

/**
 * Consumer type that retries indefinitely until success to handle the message
 * but sleep between tries.
 *
 * @param {number} sleepTime the time to wait after a failure to retry the message in milliseconds
 * @param {function} handler the message handler
 * @param {object} logger the logger
 * @returns {boolean} the handler result
 */
function* infiniteWithSleep(sleepTime, handler, logger) {
  try {
    yield handler();
    return true;
  } catch (err) {
    logger.error(
      { err, sleepTime },
      '[worker#infiniteWithSleep] Error handling message, retrying'
    );
    yield cb => setTimeout(cb, sleepTime);
    return false;
  }
}

module.exports = {
  infiniteWithSleep: sleepTime => (handler, logger) => infiniteWithSleep(sleepTime, handler, logger)
};
