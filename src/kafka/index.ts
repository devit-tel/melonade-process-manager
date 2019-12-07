import { Event, Kafka, Task, Timer } from '@melonade/melonade-declaration';
import { AdminClient, KafkaConsumer, Producer } from 'node-rdkafka';
import * as R from 'ramda';
import * as config from '../config';
import { jsonTryParse } from '../utils/common';

export const adminClient = AdminClient.create(config.kafkaAdminConfig);
export const stateConsumerClient = new KafkaConsumer(
  config.kafkaTaskConfig.config,
  config.kafkaTaskConfig.topic,
);
export const commandConsumerClient = new KafkaConsumer(
  config.kafkaCommandConfig.config,
  config.kafkaCommandConfig.topic,
);
export const producerClient = new Producer(
  config.kafkaProducerConfig.config,
  config.kafkaProducerConfig.topic,
);

export const isHealthy = (): boolean => {
  return R.all(R.equals(true), [
    commandConsumerClient.isConnected(),
    producerClient.isConnected(),
  ]);
};

stateConsumerClient.setDefaultConsumeTimeout(5);
stateConsumerClient.on('ready', async () => {
  console.log('State consumer kafka is ready');

  try {
    await createTopic(config.kafkaTopicName.event, 20, 1);
  } catch (error) {
    console.warn(
      `Create topic "${
        config.kafkaTopicName.event
      }" error: ${error.toString()}`,
    );
  } finally {
    stateConsumerClient.subscribe([config.kafkaTopicName.event]);
  }
});

commandConsumerClient.setDefaultConsumeTimeout(5);
commandConsumerClient.on('ready', async () => {
  console.log('Command consumer kafka is ready');
  try {
    await createTopic(config.kafkaTopicName.event, 20, 1);
  } catch (error) {
    console.warn(
      `Create topic "${
        config.kafkaTopicName.command
      }" error: ${error.toString()}`,
    );
  } finally {
    commandConsumerClient.subscribe([config.kafkaTopicName.command]);
  }
});

producerClient.setPollInterval(100);
producerClient.on('ready', () => {
  console.log('Producer kafka is ready');
});

export const createTopic = (
  tipicName: string,
  numPartitions: number = 10,
  replicationFactor?: number,
  config?: any,
): Promise<any> =>
  new Promise((resolve: Function, reject: Function) => {
    adminClient.createTopic(
      {
        topic: tipicName,
        num_partitions: numPartitions,
        replication_factor: replicationFactor,
        config: {
          'cleanup.policy': 'compact',
          'compression.type': 'snappy',
          'delete.retention.ms': '86400000',
          'file.delete.delay.ms': '60000',
          ...config,
        },
      },
      (error: Error, data: any) => {
        if (error) return reject(error);
        resolve(data);
      },
    );
  });

export const createTaskTopic = (taskName: string): Promise<any> =>
  createTopic(`${config.kafkaTopicName.task}.${taskName}`, 10, 1);

export const poll = (
  consumer: KafkaConsumer,
  messageNumber: number = 100,
): Promise<any[]> =>
  new Promise((resolve: Function, reject: Function) => {
    consumer.consume(
      messageNumber,
      (error: Error, messages: Kafka.kafkaConsumerMessage[]) => {
        if (error) return reject(error);
        resolve(
          messages.map((message: Kafka.kafkaConsumerMessage) =>
            jsonTryParse(message.value.toString(), {}),
          ),
        );
      },
    );
  });

export const sendTimer = (timer: Timer.AllTimerType) =>
  producerClient.produce(
    config.kafkaTopicName.timer,
    null,
    Buffer.from(JSON.stringify(timer)),
    null,
    Date.now(),
  );

export const dispatch = (task: Task.ITask) =>
  producerClient.produce(
    `${config.kafkaTopicName.task}.${task.taskName}`,
    null,
    Buffer.from(JSON.stringify(task)),
    task.transactionId,
    Date.now(),
  );

// Use to send Retry, Failed, Reject event, Completed workflow, Dispatch task
export const sendEvent = (event: Event.AllEvent) =>
  producerClient.produce(
    config.kafkaTopicName.store,
    null,
    Buffer.from(JSON.stringify(event)),
    event.transactionId,
    Date.now(),
  );

export const flush = (timeout: number = 1000) =>
  new Promise((resolve: Function, reject: Function) => {
    producerClient.flush(timeout, (error: Error) => {
      if (error) return reject(error);
      resolve();
    });
  });
