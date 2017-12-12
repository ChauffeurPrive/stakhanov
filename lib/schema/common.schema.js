'use strict';

const Joi = require('joi');

const DEFAULT_HEARTBEAT = 10;
const DEFAULT_TASK_TIMEOUT = 30000;
const DEFAULT_PROCESS_TIMEOUT = 3000;
const DEFAULT_CHANNEL_CLOSE_TIMEOUT = 500;
const DEFAULT_PREFETCH = 100;

const handlerSchema = Joi.func().required();

const baseConfigurationSchema = Joi.object({
  workerName: Joi.string().required(),
  amqpUrl: Joi.string().required(),
  exchangeName: Joi.string().required(),
  queueName: Joi.string().required()
});

const baseOptionsSchema = Joi.object({
  heartbeat: Joi.number().positive().default(DEFAULT_HEARTBEAT),
  taskTimeout: Joi.number().positive().default(DEFAULT_TASK_TIMEOUT),
  processExitTimeout: Joi.number().positive().default(DEFAULT_PROCESS_TIMEOUT),
  channelCloseTimeout: Joi.number().positive().default(DEFAULT_CHANNEL_CLOSE_TIMEOUT),
  closeOnSignals: Joi.bool().default(false),
  channelPrefetch: Joi.number().positive().default(DEFAULT_PREFETCH),
  logger: Joi.object().keys({
    debug: Joi.func().required(),
    info: Joi.func().required(),
    warn: Joi.func().required(),
    error: Joi.func().required()
  }).default({
    debug: /* istanbul ignore next */ () => null,
    info: /* istanbul ignore next */ () => null,
    warn: /* istanbul ignore next */ () => null,
    error: /* istanbul ignore next */ () => null
  }).unknown()
});

module.exports = {
  handlerSchema,
  baseConfigurationSchema,
  baseOptionsSchema
};
