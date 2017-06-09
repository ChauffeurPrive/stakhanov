'use strict';

const Joi = require('joi');

const { baseConfigurationSchema, baseOptionsSchema, handlerSchema } = require('./common.schema');

const configurationSchema = baseConfigurationSchema.keys({
  handlers: Joi.array().items(Joi.object().keys({
    handle: handlerSchema,
    validate: Joi.func().required(),
    routingKey: Joi.string().required()
  })).required()
});

/**
 * Try to validate an object against configurationSchema
 * @param {Object} obj express request
 * @returns {Object} validated object
 */
function applyConfiguration(obj) {
  return Joi.attempt(obj, configurationSchema);
}

/**
 * Try to validate an object against optionsSchema
 * @param {Object} obj express request
 * @returns {Object} validated object
 */
function applyOptions(obj) {
  return Joi.attempt(obj, baseOptionsSchema);
}

module.exports = {
  applyConfiguration,
  applyOptions
};
