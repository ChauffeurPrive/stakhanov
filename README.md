# BusyBee
[![CircleCI](https://circleci.com/gh/ChauffeurPrive/busybee/tree/master.svg?style=shield&circle-token=9a4d0d25bd8e0134d33f386a66c90c80dd401cf1)](https://circleci.com/gh/ChauffeurPrive/busybee/tree/master)
[![codecov](https://codecov.io/gh/ChauffeurPrive/busybee/branch/master/graph/badge.svg)](https://codecov.io/gh/ChauffeurPrive/busybee)

BusyBee allows you to easily create workers that handle tasks from an AMQP queue. 
It handles common concerns related to implementing a worker with AMQP:
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
    yield worker.close();
```
Remark: for testing purpose, as the close function will eventually execute a process.exit, 
you can add the following parameter to the close function:
```javascript
    yield worker.close(false);
```
### Dev Requirements

Install Node 6.

For nvm users, just move to the project directory and run :

    nvm i

If you already have installed Node 6 before, just type:

    nvm use
