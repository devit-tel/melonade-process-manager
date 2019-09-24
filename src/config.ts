import * as dotenv from 'dotenv';
import { StoreType } from './constants/store';
import * as kafkaConstant from './constants/kafka';

dotenv.config();
const pickAndReplaceFromENV = (template: string) =>
  Object.keys(process.env).reduce((result: any, key: string) => {
    if (new RegExp(template).test(key)) {
      return {
        ...result,
        [key.replace(new RegExp(template), '')]: process.env[key],
      };
    }
    return result;
  }, {});

export const saga = {
  namespace: process.env['saga.namespace'] || 'node',
};

export const server = {
  enabled: process.env['server.enabled'] === 'true',
  port: +process.env['server.port'] || 8080,
  hostname: process.env['server.hostname'] || '127.0.0.1',
};

export const kafkaTopicName = {
  // Publish to specified task
  task: `${saga.namespace}.${kafkaConstant.PREFIX}.${kafkaConstant.TASK_TOPIC_NAME}`,
  // Publish to system task
  systemTask: `${saga.namespace}.${kafkaConstant.PREFIX}.${kafkaConstant.SYSTEM_TASK_TOPIC_NAME}`,
  // Publish to store event
  store: `${saga.namespace}.${kafkaConstant.PREFIX}.${kafkaConstant.STORE_TOPIC_NAME}`,
  // Subscriptions to update event
  event: `${saga.namespace}.${kafkaConstant.PREFIX}.${kafkaConstant.EVENT_TOPIC}`,
};

export const kafkaAdmin = {
  ...pickAndReplaceFromENV('^kafka\\.conf\\.'),
  ...pickAndReplaceFromENV('^admin\\.kafka\\.conf\\.'),
};

export const kafkaState = {
  config: {
    'enable.auto.commit': 'false',
    'group.id': `saga-${saga.namespace}-state`,
    ...pickAndReplaceFromENV('^kafka\\.conf\\.'),
    ...pickAndReplaceFromENV('^state\\.kafka\\.conf\\.'),
  },
  topic: {
    'auto.offset.reset': 'earliest',
    ...pickAndReplaceFromENV('^kafka\\.topic-conf\\.'),
    ...pickAndReplaceFromENV('^state\\.kafka\\.topic-conf\\.'),
  },
};

export const kafkaSystemConsumer = {
  config: {
    'enable.auto.commit': 'false',
    'group.id': `saga-${saga.namespace}-system`,
    ...pickAndReplaceFromENV('^kafka\\.conf\\.'),
    ...pickAndReplaceFromENV('^state\\.kafka\\.conf\\.'),
  },
  topic: {
    'auto.offset.reset': 'earliest',
    ...pickAndReplaceFromENV('^kafka\\.topic-conf\\.'),
    ...pickAndReplaceFromENV('^state\\.kafka\\.topic-conf\\.'),
  },
};

export const kafkaProducer = {
  config: {
    'compression.type': 'snappy',
    'enable.idempotence': 'true',
    'message.send.max.retries': '100000',
    'socket.keepalive.enable': 'true',
    'queue.buffering.max.messages': '10000',
    'queue.buffering.max.ms': '1',
    'batch.num.messages': '100',
    ...pickAndReplaceFromENV('^kafka\\.conf\\.'),
    ...pickAndReplaceFromENV('^producer\\.kafka\\.conf\\.'),
  },
  topic: {
    ...pickAndReplaceFromENV('^kafka\\.topic\\.'),
    ...pickAndReplaceFromENV('^producer\\.kafka\\.topic\\.'),
  },
};

export const taskDefinitionStore = {
  type: StoreType.ZooKeeper,
  zookeeperConfig: {
    root: `/saga-pm-${saga.namespace}/task-definition`,
    connectionString: process.env['task-definition.zookeeper.connections'],
    options: {
      sessionTimeout: 30000,
      spinDelay: 1000,
      retries: 0,
    },
  },
};

export const workflowDefinitionStore = {
  type: StoreType.ZooKeeper,
  zookeeperConfig: {
    root: `/saga-pm-${saga.namespace}/workflow-definition`,
    connectionString: process.env['workflow-definition.zookeeper.connections'],
    options: {
      sessionTimeout: 30000,
      spinDelay: 1000,
      retries: 0,
    },
  },
};

export const taskInstanceStore = {
  type: StoreType.MongoDB,
  mongoDBConfig: {
    uri: process.env['task-instance.mongodb.uri'],
    options: {
      dbName: `saga-pm-${saga.namespace}`,
      useNewUrlParser: true,
      useCreateIndex: true,
      reconnectTries: Number.MAX_SAFE_INTEGER,
      poolSize: 100,
      useFindAndModify: false,
    },
  },
};

export const workflowInstanceStore = {
  type: StoreType.MongoDB,
  mongoDBConfig: {
    uri: process.env['workflow-instance.mongodb.uri'],
    options: {
      dbName: `saga-pm-${saga.namespace}`,
      useNewUrlParser: true,
      useCreateIndex: true,
      reconnectTries: Number.MAX_SAFE_INTEGER,
      poolSize: 100,
      useFindAndModify: false,
    },
  },
};

export const transactionInstanceStore = {
  type: StoreType.MongoDB,
  mongoDBConfig: {
    uri: process.env['transaction-instance.mongodb.uri'],
    options: {
      dbName: `saga-pm-${saga.namespace}`,
      useNewUrlParser: true,
      useCreateIndex: true,
      reconnectTries: Number.MAX_SAFE_INTEGER,
      poolSize: 100,
      useFindAndModify: false,
    },
  },
};
