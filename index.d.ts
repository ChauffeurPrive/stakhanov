// Type definitions for stakhanov 0.7.0
// Project: stakhanov
// Definitions by: Chauffeur Privé
// TypeScript Version: 3.0.1

/// <reference types="node" />

interface Logger {
  debug: () => void;
  info: () => void;
  warn: () => void;
  error: () => void;
}

declare namespace Stakhanov {
  export function createWorkers(
    handlers: Stakhanov.Handler[],
    config: Stakhanov.Config,
    options?: Stakhanov.Options
  ): Stakhanov.Process;
}

declare namespace Stakhanov {
  export interface Process {
    listen: () => void;
    close: (forceExit?: Boolean) => void;
    wait: (eventName: string, timeout?: number) => Promise<void>;
    TASK_COMPLETED: string;
    TASK_RETRIED: string;
    TASK_FAILED: string;
    WORKER_CLOSED: string;
  }

  export interface Handler<TBusMessage = any, TValidatedMessage = any> {
    routingKey: string;
    validate: (message: TBusMessage) => TValidatedMessage;
    handle: (message: TValidatedMessage) => void;
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
    closeOnSignals?: Boolean;
    channelCloseTimeout?: number;
    logger?: Logger;
  }
}

export = Stakhanov;
