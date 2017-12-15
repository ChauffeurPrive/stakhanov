# Stakhanov
[![CircleCI](https://circleci.com/gh/ChauffeurPrive/stakhanov.svg?style=shield&circle-token=9a4d0d25bd8e0134d33f386a66c90c80dd401cf1)](https://circleci.com/gh/ChauffeurPrive/stakhanov)
[![codecov](https://codecov.io/gh/ChauffeurPrive/stakhanov/branch/master/graph/badge.svg)](https://codecov.io/gh/ChauffeurPrive/stakhanov)
[![package](https://img.shields.io/npm/v/stakhanov.svg)](https://www.npmjs.com/package/stakhanov)
[![License](https://img.shields.io/github/license/ChauffeurPrive/stakhanov.svg)](LICENSE)

[Stakhanov](https://fr.wikipedia.org/wiki/Alekse%C3%AF_Stakhanov) allows you to easily create workers that handle 
tasks from an AMQP queue. It handles common concerns related to implementing a worker with AMQP:
- Number of tasks handled at the same time
- Timeout after which the task is considered as failed
- Handle disconnections from the AMQP server
- Validating the schema of the message specifying the task

**WARNING**

The `queueName` configuration must be unique for each worker, otherwise messages won't necessarily be routed to 
the good consumer.

When listening, the lib will create a queue of the form `queueName.routingKey` for each routing key/handler. 
That is why the queueName config must really be unique, typically of the form `application.workername`. 
This will generate a unique queue name per routing key, of the form `application.workername.routingkey`.

Example:

```javascript
    function* handle(msg) { ... };
    function* validate(msg) { ... };

    const worker = workerlib.createWorkers([{
      handle: handle,
      validate: validate,
      routingKey: 'application.something_happened'
    }], {
      workerName: 'my worker',
      amqpUrl: 'amqp://guest:guest@localhost:5672',
      exchangeName: 'bus',
      queueName: 'example.simple_worker'
    }, {
      channelPrefetch: 50,
      taskTimeout: 30000,
      processExitTimeout: 3000,
      channelCloseTimeout: 500,
    });
```

Spec:
    
    createWorkers(handlers, config, options = {})

Create and return a worker instance.

#### handlers

An array of handlers to handle incoming messages, each handler is an object with the following keys:
* `routingKey`: name of the routing key to bind to
* `handle`: function to handle incoming messages (see example below)
* `validate`: function validating incoming messages bodies (see example below). If the function does not throw, the message is considered valid

#### config

Configuration of the worker:
* `amqpUrl`: url of the AMQP broker
* `exchangeName`: name of the exchange to listen on
* `exchangeType`: type of the exchange (default to `topic`)
* `queueName`: name of the queue to bind to / create
* `queueoptions`: queue options (default to `{}`)
* `workerName`: name of the worker, used for logging purposes

#### options
Optional parameters for the worker:
* `heartbeat`: if provided, will override default [heartbeat](https://www.rabbitmq.com/heartbeats.html) value (in seconds, default 10)
* `taskTimeout`: task timeout (maximum time in milliseconds allowed to be spent on message handling, default 30000)
* `processExitTimeout`:  process exit timeout (maximum time in milliseconds the worker will wait for connections to close before forcing exit, default 3000)
* `channelCloseTimeout`:  timeout between channel cancelation and close (maximum time in milliseconds the worker will let unfinished messages processing before nacking them, default 500)
* `closeOnSignals`:  listen to SIGINT/SIGTERM and call worker.close for a graceful shutdown (default false)
* `channelPrefetch`:  channel [prefetch](https://www.rabbitmq.com/consumer-prefetch.html) value (default 100)
* `logger`:  logger object implementing common logging functions (debug, info, warn, error)


### Basic use

To listen on channel:
```javascript
    yield worker.listen();
```
To shutdown worker:
```javascript
    yield worker.close();
```
Remark: for testing purpose, as the close function will eventually execute a process.exit, 
you can add the following parameter to the close function:
```javascript
    yield worker.close(false);
```

### Events

To organize your own tests, the worker instance allows you to wait for specific event with the `wait` method.

Example:

    yield worker.wait('task.completed');

Spec:

    wait(event, timeout)

The wait method returns a Promise which will be completed when the expected event
occurs for the first time, or rejected after a timeout.

`event`: name of the event, required. Must be one of the available events:

- `task.completed`: emitted when a task has been completed.
- `task.retried`: emitted when a task is going to be retried because the
 handler has failed.
- `task.failed`: emitted when a task has failed because the handler
 has failed on a task which was already being retried.
- `task.closed`: emitted when the worker has been closed.

`timeout`: timeout in milliseconds after which the promise will be rejected. Defaults
to 1000 ms.

### Dev Requirements

Install Node 6.

For nvm users, just move to the project directory and run :

    nvm i

If you already have installed Node 6 before, just type:

    nvm use
