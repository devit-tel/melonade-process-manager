import { Event, Task, Timer } from '@melonade/melonade-declaration';
import { CommandTypes } from '@melonade/melonade-declaration/build/command';
import { TaskStates } from '@melonade/melonade-declaration/build/state';
import { TimerTypes } from '@melonade/melonade-declaration/build/timer';
import {
  AdminClient,
  KafkaConsumer,
  LibrdKafkaError,
  Message,
  Producer,
  TopicPartitionOffset,
} from 'node-rdkafka';
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
    await createTopic(
      config.kafkaTopicName.event,
      config.kafkaTopic.num_partitions,
      config.kafkaTopic.replication_factor,
    );
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
    await createTopic(
      config.kafkaTopicName.command,
      config.kafkaTopic.num_partitions,
      config.kafkaTopic.replication_factor,
    );
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
  topicName: string,
  numPartitions: number,
  replicationFactor: number,
  config?: any,
): Promise<any> =>
  new Promise((resolve: Function, reject: Function) => {
    adminClient.createTopic(
      {
        topic: topicName,
        num_partitions: numPartitions,
        replication_factor: replicationFactor,
        config: {
          'cleanup.policy': 'delete',
          'compression.type': 'snappy',
          'retention.ms': '604800000', // '604800000' 7 days // '2592000000' 30 days
          'unclean.leader.election.enable': 'false',
          ...config,
        },
      },
      (error: LibrdKafkaError) => {
        if (error) return reject(error);
        resolve();
      },
    );
  });

export const createTaskTopic = (taskName: string): Promise<any> =>
  createTopic(
    `${config.kafkaTopicName.task}.${taskName}`,
    config.kafkaTopic.num_partitions,
    config.kafkaTopic.replication_factor,
  );

export const pollWithMessage = <T = any>(
  consumer: KafkaConsumer,
  messageNumber: number = 100,
): Promise<[T[], TopicPartitionOffset[]]> =>
  new Promise((resolve: Function, reject: Function) => {
    consumer.consume(
      messageNumber,
      (error: LibrdKafkaError, messages: Message[]) => {
        if (error) return reject(error);
        resolve([
          messages.map((message: Message) => {
            return jsonTryParse<T>(message.value.toString());
          }),
          messages,
        ]);
      },
    );
  });

export interface IReminderRequest {
  when: Date;
  topic: string;
  payload: any;
  key: string;
}

export const sendReminder = (payload: IReminderRequest) => {
  producerClient.produce(
    config.kafkaTopicName.reminder,
    null,
    Buffer.from(JSON.stringify(payload)),
    '',
    Date.now(),
  );
};

export const sendTimer = (
  timer: Timer.IDelayTaskTimer | Timer.IScheduleTaskTimer,
) => {
  switch (timer.type) {
    case TimerTypes.delayTask:
      sendReminder({
        payload: {
          type: CommandTypes.ReloadTask,
          transactionId: timer.task.transactionId,
          task: timer.task,
        },
        topic: config.kafkaTopicName.command,
        key: timer.task.transactionId,
        when: new Date(timer.task.startTime),
      });
      break;

    case TimerTypes.scheduleTask:
      sendReminder({
        payload: {
          transactionId: timer.transactionId,
          taskId: timer.taskId,
          isSystem: true,
          status: TaskStates.Completed,
        },
        topic: config.kafkaTopicName.event,
        key: timer.transactionId,
        when: new Date(timer.completedAt),
      });
      break;
  }

  producerClient.produce(
    config.kafkaTopicName.timer,
    null,
    Buffer.from(JSON.stringify(timer)),
    timer.type === Timer.TimerTypes.delayTask
      ? timer.task.transactionId
      : timer.transactionId,
    Date.now(),
  );
};

export const dispatch = (task: Task.ITask) => {
  producerClient.produce(
    `${config.kafkaTopicName.task}.${task.taskName}`,
    null,
    Buffer.from(JSON.stringify(task)),
    task.transactionId,
    Date.now(),
  );

  if (task.ackTimeout > 0) {
    sendReminder({
      payload: {
        transactionId: task.transactionId,
        taskId: task.taskId,
        isSystem: true,
        status: TaskStates.AckTimeOut,
      },
      topic: config.kafkaTopicName.event,
      key: task.transactionId,
      when: new Date(task.ackTimeout + Date.now()),
    });
  }

  if (task.timeout > 0) {
    sendReminder({
      payload: {
        transactionId: task.transactionId,
        taskId: task.taskId,
        isSystem: true,
        status: TaskStates.Timeout,
      },
      topic: config.kafkaTopicName.event,
      key: task.transactionId,
      when: new Date(task.timeout + Date.now()),
    });
  }
};

// TODO Since we have distributed lock, this need to rewrite using state.processTask instead !!
// Use to send update event to another PM or itself to make sure ordering
export const sendUpdate = (taskUpdate: Event.ITaskUpdate) =>
  producerClient.produce(
    config.kafkaTopicName.event,
    null,
    Buffer.from(JSON.stringify(taskUpdate)),
    taskUpdate.transactionId,
    Date.now(),
  );

// Use to send Retry, Failed, Reject event, Completed workflow, Dispatch task
export const sendEvent = (event: Event.AllEvent) => {
  try {
    return producerClient.produce(
      config.kafkaTopicName.store,
      null,
      Buffer.from(JSON.stringify(event)),
      event.transactionId,
      Date.now(),
    );
  } catch (error) {
    const errEvn: Event.ISystemErrorEvent = {
      transactionId: event.transactionId,
      details: {},
      error: `${error}`,
      timestamp: Date.now(),
      type: 'SYSTEM',
      isError: true,
    };
    return producerClient.produce(
      config.kafkaTopicName.store,
      null,
      Buffer.from(JSON.stringify(errEvn)),
      event.transactionId,
      Date.now(),
    );
  }
};

export const flush = (timeout: number = 1000) =>
  new Promise((resolve: Function, reject: Function) => {
    producerClient.flush(timeout, (error: LibrdKafkaError) => {
      if (error) return reject(error);
      resolve();
    });
  });
