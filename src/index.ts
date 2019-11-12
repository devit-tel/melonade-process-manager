import * as cluster from 'cluster';
import * as dotenv from 'dotenv';
import * as os from 'os';

dotenv.config();

const maxRunnerNumber = Number.isNaN(+process.env['runners.max'])
  ? os.cpus().length
  : +process.env['runners.max'];

if (cluster.isMaster) {
  cluster.on('exit', (worker: cluster.Worker) => {
    console.log(`Worker: ${worker.id} are dead`);
    setTimeout(() => {
      cluster.fork();
      console.log(`Starting new worker`);
    }, 1000);
  });

  cluster.on('fork', (worker: cluster.Worker) => {
    console.log(`Worker ${worker.process.pid} started`);
  });

  const runnerCount = Math.min(os.cpus().length, maxRunnerNumber);
  for (let i = 0; i < runnerCount; i++) {
    cluster.fork();
  }
} else {
  require('./bootstrap');
}
