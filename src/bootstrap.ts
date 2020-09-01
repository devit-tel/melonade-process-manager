import { Store } from '@melonade/melonade-declaration';
import { executor as commandExecutor } from './command';
import * as config from './config';
import {
  commandConsumerClient,
  producerClient,
  stateConsumerClient,
} from './kafka';
import { Server } from './server';
import { executor as stateExecutor } from './state';
import {
  distributedLockStore,
  taskDefinitionStore,
  taskInstanceStore,
  transactionInstanceStore,
  workflowDefinitionStore,
  workflowInstanceStore,
} from './store';
import { TaskInstanceMongooseStore } from './store/mongoose/taskInstance';
import { TransactionInstanceMongooseStore } from './store/mongoose/transactionInstance';
import { WorkflowInstanceMongooseStore } from './store/mongoose/workflowInstance';
import { DistributedLockRedisStore } from './store/redis/distributedLock';
import { TaskInstanceRedisStore } from './store/redis/taskInstance';
import { TransactionInstanceRedisStore } from './store/redis/transactionInstance';
import { WorkflowInstanceRedisStore } from './store/redis/workflowInstance';
import { TaskDefinitionZookeeperStore } from './store/zookeeper/taskDefinition';
import { WorkflowDefinitionZookeeperStore } from './store/zookeeper/workflowDefinition';
// import { MemoryStore } from './store/memory';

stateConsumerClient.connect();
commandConsumerClient.connect();
producerClient.connect();

switch (config.workflowDefinitionStoreConfig.type) {
  case Store.StoreType.ZooKeeper:
    workflowDefinitionStore.setClient(
      new WorkflowDefinitionZookeeperStore(
        config.workflowDefinitionStoreConfig.zookeeperConfig.root,
        config.workflowDefinitionStoreConfig.zookeeperConfig.connectionString,
        config.workflowDefinitionStoreConfig.zookeeperConfig.options,
      ),
    );
    break;
  default:
    throw new Error(
      `WorkflowDefinition Store: ${config.workflowDefinitionStoreConfig.type} is invalid`,
    );
}

switch (config.taskDefinitionStoreConfig.type) {
  case Store.StoreType.ZooKeeper:
    taskDefinitionStore.setClient(
      new TaskDefinitionZookeeperStore(
        config.taskDefinitionStoreConfig.zookeeperConfig.root,
        config.taskDefinitionStoreConfig.zookeeperConfig.connectionString,
        config.taskDefinitionStoreConfig.zookeeperConfig.options,
      ),
    );
    break;
  default:
    throw new Error(
      `TaskDefinition Store: ${config.taskDefinitionStoreConfig.type} is invalid`,
    );
}

switch (config.transactionInstanceStoreConfig.type) {
  // case Store.StoreType.Memory:
  //   transactionInstanceStore.setClient(new MemoryStore());
  //   break;
  case Store.StoreType.MongoDB:
    transactionInstanceStore.setClient(
      new TransactionInstanceMongooseStore(
        config.transactionInstanceStoreConfig.mongoDBConfig.uri,
        config.transactionInstanceStoreConfig.mongoDBConfig.options,
      ),
    );
    break;
  case Store.StoreType.Redis:
    transactionInstanceStore.setClient(
      new TransactionInstanceRedisStore(
        config.transactionInstanceStoreConfig.redisConfig,
      ),
    );
    break;
  default:
    throw new Error(
      `TranscationInstance Store: ${config.transactionInstanceStoreConfig.type} is invalid`,
    );
}

switch (config.workflowInstanceStoreConfig.type) {
  // case Store.StoreType.Memory:
  //   workflowInstanceStore.setClient(new MemoryStore());
  //   break;
  case Store.StoreType.MongoDB:
    workflowInstanceStore.setClient(
      new WorkflowInstanceMongooseStore(
        config.workflowInstanceStoreConfig.mongoDBConfig.uri,
        config.workflowInstanceStoreConfig.mongoDBConfig.options,
      ),
    );
    break;
  case Store.StoreType.Redis:
    workflowInstanceStore.setClient(
      new WorkflowInstanceRedisStore(
        config.workflowInstanceStoreConfig.redisConfig,
      ),
    );
    break;
  default:
    throw new Error(
      `WorkflowInstance Store: ${config.workflowInstanceStoreConfig.type} is invalid`,
    );
}

switch (config.taskInstanceStoreConfig.type) {
  // case Store.StoreType.Memory:
  //   taskInstanceStore.setClient(new MemoryStore());
  //   break;
  case Store.StoreType.MongoDB:
    taskInstanceStore.setClient(
      new TaskInstanceMongooseStore(
        config.taskInstanceStoreConfig.mongoDBConfig.uri,
        config.taskInstanceStoreConfig.mongoDBConfig.options,
      ),
    );
    break;
  case Store.StoreType.Redis:
    taskInstanceStore.setClient(
      new TaskInstanceRedisStore(config.taskInstanceStoreConfig.redisConfig),
    );
    break;
  default:
    throw new Error(
      `TaskInstance Store: ${config.taskInstanceStoreConfig.type} is invalid`,
    );
}

switch (config.distributedLockStoreConfig.type) {
  case Store.StoreType.Redis:
    distributedLockStore.setClient(
      new DistributedLockRedisStore(
        config.distributedLockStoreConfig.redisConfig,
        config.melonade.namespace,
      ),
    );
    break;
  default:
    throw new Error(
      `TaskInstance Store: ${config.distributedLockStoreConfig.type} is invalid`,
    );
}

if (config.server.enabled) {
  new Server(config.server.port, config.server.hostname, true);
}

stateExecutor();
commandExecutor();
