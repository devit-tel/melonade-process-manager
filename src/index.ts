import * as cluster from 'cluster';
import * as os from 'os';

if (cluster.isMaster) {
  cluster.on('exit', worker => {
    console.log(`Workker: ${worker.id} are dead`);
    cluster.fork();
    console.log(`Starting new workker`);
  });

  cluster.on('fork', worker => {
    console.log(`Worker ${worker.process.pid} started`);
  });

  const cpuCount = os.cpus().length;
  for (let i = 0; i < cpuCount; i++) {
    cluster.fork();
  }
} else {
  require('./bootstrap');
  console.log(`workker`);
}
