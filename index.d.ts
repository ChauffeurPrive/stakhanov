// Type definitions for stakhanov 1.0.0
// Project: stakhanov
// Definitions by: Chauffeur Privé
// TypeScript Version: 3.0.1

/// <reference types="node" />

interface Logger {
  debug: () => void;
  info: () => void;
  warn: () => void;
  error: () => void;
  child: (context: object) => Logger;
}

interface AMQPFields {
  redelivered: boolean;
}

declare namespace Stakhanov {
  export interface Process {
    listen: () => void;
    close: (forceExit?: boolean) => void;
    wait: (eventName: string, timeout?: number) => Promise<void>;
    TASK_COMPLETED: string;
    TASK_FAILED: string;
    WORKER_CLOSED: string;
  }

  export interface Handler<TBusMessage = any, TValidatedMessage = any> {
    routingKey: string;
    validate: (message: TBusMessage) => TValidatedMessage;
    handle: (message: TValidatedMessage) => boolean;
    consumer: (handler, logger: Logger, fields?: AMQPFields) => boolean;
  }

  export interface Config {
    workerName: string;
    amqpUrl: string;
    exchangeName: string;
    queueName: string;
  }

  export interface Options {
    heartbeat?: number;
    taskTimeout?: number;
    processExitTimeout?: number;
    channelPrefetch?: number;
    closeOnSignals?: boolean;
    channelCloseTimeout?: number;
    logger?: Logger;
  }

  export function createWorkers(
    handlers: Handler[],
    config: Config,
    options?: Options
  ): Process;

  // TODO: add consumers
}

export = Stakhanov;
