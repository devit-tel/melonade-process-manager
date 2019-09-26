import * as dotenv from 'dotenv';
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
  // Subscriptions to command
  command: `${saga.namespace}.${kafkaConstant.PREFIX}.${kafkaConstant.COMMAND_TOPIC_NAME}`,
};

export const kafkaAdminConfig = {
  ...pickAndReplaceFromENV('^kafka\\.conf\\.'),
  ...pickAndReplaceFromENV('^admin\\.kafka\\.conf\\.'),
};

export const kafkaTaskConfig = {
  config: {
    'enable.auto.commit': 'false',
    'group.id': `saga-${saga.namespace}-state`,
    ...pickAndReplaceFromENV('^kafka\\.conf\\.'),
    ...pickAndReplaceFromENV('^task\\.kafka\\.conf\\.'),
  },
  topic: {
    'auto.offset.reset': 'earliest',
    ...pickAndReplaceFromENV('^kafka\\.topic-conf\\.'),
    ...pickAndReplaceFromENV('^task\\.kafka\\.topic-conf\\.'),
  },
};

export const kafkaSystemTaskConfig = {
  config: {
    'enable.auto.commit': 'false',
    'group.id': `saga-${saga.namespace}-system`,
    ...pickAndReplaceFromENV('^kafka\\.conf\\.'),
    ...pickAndReplaceFromENV('^system-task\\.kafka\\.conf\\.'),
  },
  topic: {
    'auto.offset.reset': 'earliest',
    ...pickAndReplaceFromENV('^kafka\\.topic-conf\\.'),
    ...pickAndReplaceFromENV('^system-task\\.kafka\\.topic-conf\\.'),
  },
};

export const kafkaCommandConfig = {
  config: {
    'enable.auto.commit': 'false',
    'group.id': `saga-${saga.namespace}-command`,
    ...pickAndReplaceFromENV('^kafka\\.conf\\.'),
    ...pickAndReplaceFromENV('^command\\.kafka\\.conf\\.'),
  },
  topic: {
    'auto.offset.reset': 'earliest',
    ...pickAndReplaceFromENV('^kafka\\.topic-conf\\.'),
    ...pickAndReplaceFromENV('^system-task\\.kafka\\.topic-conf\\.'),
  },
};

export const kafkaProducerConfig = {
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
    ...pickAndReplaceFromENV('^kafka\\.topic-conf\\.'),
    ...pickAndReplaceFromENV('^producer\\.kafka\\.topic-conf\\.'),
  },
};

export const taskDefinitionStoreConfig = {
  type: process.env['task-definition.type'],
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

export const workflowDefinitionStoreConfig = {
  type: process.env['task-definition.type'],
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

export const taskInstanceStoreConfig = {
  type: process.env['task-instance.type'],
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

export const workflowInstanceStoreConfig = {
  type: process.env['workflow-instance.type'],
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

export const transactionInstanceStoreConfig = {
  type: process.env['transaction-instance.type'],
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
