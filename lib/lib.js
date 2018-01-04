'use strict';

const co = require('co');

/**
 * Make a promise outside of a yieldable.
 * To avoid unhandled callbacks resulting in unacked messages piling up in amqp,
 * the returned promise will fail after a specified timeout.
 * @param {Promise|GeneratorFunction} yieldable a yieldable (generatorFunction or promise)
 * @param {String} name  Name for error handling
 * @param {Number} timeout Time after which the promise fails
 * @returns {Promise} the promise
 */
function promisifyWithTimeout(yieldable, name, timeout) {
  return new Promise((resolve, reject) => {
    const gen = yieldable();
    return co(function* () {
      yield [
        new Promise((_, _reject) => setTimeout(() => _reject(new Error(`Yieldable timeout in ${name}`)), timeout)),
        gen
      ]
    })
      .catch(err => {
        // ends the gen
        gen.return();
        reject(err);
      })
  });
}


module.exports = {
  promisifyWithTimeout
};
