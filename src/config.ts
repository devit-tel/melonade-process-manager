import { Kafka } from '@melonade/melonade-declaration';
import * as dotenv from 'dotenv';

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

export const melonade = {
  namespace: process.env['melonade.namespace'] || 'default',
  example: process.env['melonade.example'] === 'true',
};

export const server = {
  enabled: process.env['server.enabled'] === 'true',
  port: +process.env['server.port'] || 8080,
  hostname: process.env['server.hostname'] || '127.0.0.1',
};

export const prefix = `${Kafka.topicPrefix}.${melonade.namespace}`;

export const kafkaTopicName = {
  // Publish to specified task
  task: `${prefix}.${Kafka.topicSuffix.task}`,
  // Publish to store event
  store: `${prefix}.${Kafka.topicSuffix.store}`,
  // Subscriptions to update event
  event: `${prefix}.${Kafka.topicSuffix.event}`,
  // Subscriptions to command
  command: `${prefix}.${Kafka.topicSuffix.command}`,
  // Timer event (Cron, Delay task)
  timer: `${prefix}.${Kafka.topicSuffix.timer}`,
};

export const kafkaTopic = {
  num_partitions: +process.env['topic.kafka.num_partitions'] || 10,
  replication_factor: +process.env['topic.kafka.replication_factor'] || 1,
};

export const kafkaAdminConfig = {
  ...pickAndReplaceFromENV('^kafka\\.conf\\.'),
  ...pickAndReplaceFromENV('^admin\\.kafka\\.conf\\.'),
};

export const kafkaTaskConfig = {
  config: {
    'enable.auto.commit': 'false',
    'group.id': `melonade-${melonade.namespace}-state`,
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
    'group.id': `melonade-${melonade.namespace}-system`,
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
    'group.id': `melonade-${melonade.namespace}-command`,
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
    retries: '10000000',
    'socket.keepalive.enable': 'true',
    'queue.buffering.max.messages': '100000',
    'queue.buffering.max.ms': '10',
    'batch.num.messages': '10000',
    ...pickAndReplaceFromENV('^kafka\\.conf\\.'),
    ...pickAndReplaceFromENV('^producer\\.kafka\\.conf\\.'),
  },
  topic: {
    acks: 'all',
    ...pickAndReplaceFromENV('^kafka\\.topic-conf\\.'),
    ...pickAndReplaceFromENV('^producer\\.kafka\\.topic-conf\\.'),
  },
};

export const taskDefinitionStoreConfig = {
  type: process.env['task-definition.type'],
  zookeeperConfig: {
    root: `/melonade-${melonade.namespace}/task-definition`,
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
    root: `/melonade-${melonade.namespace}/workflow-definition`,
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
      dbName: `melonade-${melonade.namespace}`,
      useNewUrlParser: true,
      useCreateIndex: true,
      reconnectTries: Number.MAX_SAFE_INTEGER,
      poolSize: 30,
      useFindAndModify: false,
    },
  },
  redisConfig: {
    db: '5',
    ...pickAndReplaceFromENV('^task-instance\\.redis\\.'),
  },
};

export const workflowInstanceStoreConfig = {
  type: process.env['workflow-instance.type'],
  mongoDBConfig: {
    uri: process.env['workflow-instance.mongodb.uri'],
    options: {
      dbName: `melonade-${melonade.namespace}`,
      useNewUrlParser: true,
      useCreateIndex: true,
      reconnectTries: Number.MAX_SAFE_INTEGER,
      poolSize: 30,
      useFindAndModify: false,
    },
  },
  redisConfig: {
    db: '4',
    ...pickAndReplaceFromENV('^workflow-instance\\.redis\\.'),
  },
};

export const transactionInstanceStoreConfig = {
  type: process.env['transaction-instance.type'],
  mongoDBConfig: {
    uri: process.env['transaction-instance.mongodb.uri'],
    options: {
      dbName: `melonade-${melonade.namespace}`,
      useNewUrlParser: true,
      useCreateIndex: true,
      reconnectTries: Number.MAX_SAFE_INTEGER,
      poolSize: 30,
      useFindAndModify: false,
    },
  },
  redisConfig: {
    db: '3',
    ...pickAndReplaceFromENV('^transaction-instance\\.redis\\.'),
  },
};
