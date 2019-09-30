import * as cluster from 'cluster';
import * as os from 'os';
import * as dotenv from 'dotenv';

dotenv.config();

const maxRunnerNumber = Number.isNaN(+process.env['runners.max'])
  ? os.cpus().length
  : +process.env['runners.max'];

if (cluster.isMaster) {
  cluster.on('exit', (worker: cluster.Worker) => {
    console.log(`Worker: ${worker.id} are dead`);
    cluster.fork();
    console.log(`Starting new worker`);
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
