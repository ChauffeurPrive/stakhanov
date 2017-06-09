# chpr-worker
[![CircleCI](https://circleci.com/gh/transcovo/chpr-worker.svg?style=shield)](https://circleci.com/gh/transcovo/chpr-worker)
[![codecov](https://codecov.io/gh/transcovo/chpr-worker/branch/master/graph/badge.svg)](https://codecov.io/gh/transcovo/chpr-worker)

chpr-worker allows you to easily create a worker that take tasks from an AMQP queue. It handles common concerns related to implementing a worker with AMQP:
- Number of tasks handled at the same time
- Timeout after which the task is considered as failed
- Handle disconnections from the AMQP server
- Validating the schema of the message specifying the task

**WARNING**

The `queueName` configuration must be unique for each worker, otherwise messages won't necessarily be routed to the good consumer.

When listening, the lib will create a queue of the form `queueName.routingKey` for each routing key/handler. That is why the queueName config must really be unique, typically of the form `application.workername`. This will generate a unique queue name per routing key, of the form `application.workername.routingkey`.

Example:

```javascript
    function* handle(msg) { ... };
    function* validate(msg) { ... };

    const worker = workerlib.createWorkers([{
      handle: handle,
      validate: validate,
      routingKey: 'test.something_happened'
    }], {
      workerName: 'my worker',
      amqpUrl: 'amqp://guest:guest@localhost:5672',
      exchangeName: 'bus',
      queueName: 'test.test_watcher'
    }, {
      channelPrefetch: 50,
      taskTimeout: 30000,
      processExitTimeout: 3000
    });
```
### Basic use

To listen on channel:
```javascript
    yield worker.listen();
```
To shutdown worker:
```javascript
    worker.close();
```
Remark: for testing purpose, as the close function will execute a process.exit, you can
add the following parameter to the close function:
```javascript
    worker.close(false);
```
### Dev Requirements

Install Node 6.

For nvm users, just move to the project directory and run :

    nvm i

If you already have installed Node 6 before, just type:

    nvm use
