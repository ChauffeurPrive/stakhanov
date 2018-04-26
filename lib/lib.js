'use strict';

const co = require('co');

/**
 * Make a promise outside of a yieldable.
 * To avoid unhandled callbacks resulting in unacked messages piling up in amqp,
 * the returned promise will fail after a specified timeout.
 * @param {Promise|Generator|Function} yieldable a yieldable (generator or promise)
 * @param {String} name Name for error handling
 * @param {Number} timeout Time after which the promise fails
 * @returns {Promise} the promise
 */
function promisifyWithTimeout(yieldable, name, timeout) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(`Yieldable timeout in ${name}`)), timeout);
    co(yieldable)
      .then((...args) => {
        clearTimeout(timeoutId);
        resolve(...args);
      })
      .catch((...args) => {
        clearTimeout(timeoutId);
        reject(...args);
      });
  });
}

module.exports = {
  promisifyWithTimeout
};
