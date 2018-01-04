const { promisifyWithTimeout } = require('./lib/lib');

setTimeout(() => {
  process.exit(0);
}, 10000);

function* loop() {
  let index = 0;
  while (true) {
    console.log('LOOP ', index);
    index++;
    yield new Promise(resolve => {
      setTimeout(() => { resolve() }, 1000);
    })
  }
}

promisifyWithTimeout(loop,'foo', 5000)
  .catch(err => { console.log('ERROR 1', err)})
  .then(() => console.log('succes'))
  .catch(err => { console.log('ERROR 2', err)});
