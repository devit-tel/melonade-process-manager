import { AdminClient, KafkaConsumer, Producer } from 'node-rdkafka';
import {
  kafkaAdmin,
  kafkaConsumer,
  kafkaProducer,
  kafkaTopicName,
} from '../config';
import { jsonTryParse } from '../utils/common';
import { Task, ITask } from '../task';
import { IWorkflow } from '../workflow';
import { WorkflowStates } from '../constants/workflow';
import { TaskStates } from '../constants/task';

export interface kafkaConsumerMessage {
  value: Buffer;
  size: number;
  key: string;
  topic: string;
  offset: number;
  partition: number;
}

export interface IEvent {
  workflowId: string;
  type: 'WORKFLOW' | 'TASK';
  status?: WorkflowStates | TaskStates;
  details?: IWorkflow | ITask;
  timestamp: number;
  isError: boolean;
  error?: string;
}

export const adminClient = AdminClient.create(kafkaAdmin);
export const consumerClient = new KafkaConsumer(kafkaConsumer, {});
export const systemConsumerClient = new KafkaConsumer(kafkaConsumer, {});
export const producerClient = new Producer(kafkaProducer, {});

consumerClient.connect();
consumerClient.on('ready', () => {
  console.log('Consumer kafka are ready');
  consumerClient.subscribe([kafkaTopicName.event]);
});

systemConsumerClient.connect();
systemConsumerClient.on('ready', () => {
  console.log('System consumer kafka are ready');
  systemConsumerClient.subscribe([kafkaTopicName.systemTask]);
});

producerClient.connect();
producerClient.on('ready', () => {
  console.log('Producer kafka are ready');
});

export const createTopic = (topicName: string): Promise<any> =>
  new Promise((resolve: Function, reject: Function) => {
    adminClient.createTopic(
      {
        topic: topicName,
        num_partitions: 10,
        replication_factor: 1,
        config: {
          'cleanup.policy': 'compact',
          'compression.type': 'snappy',
          'delete.retention.ms': '86400000',
          'file.delete.delay.ms': '60000',
        },
      },
      (error: Error, data: any) => {
        if (error) return reject(error);
        resolve(data);
      },
    );
  });

export const poll = (
  consumer: KafkaConsumer,
  messageNumber: number = 100,
): Promise<any[]> =>
  new Promise((resolve: Function, reject: Function) => {
    consumer.consume(
      messageNumber,
      (error: Error, messages: kafkaConsumerMessage[]) => {
        if (error) return reject(error);
        resolve(
          messages.map((message: kafkaConsumerMessage) =>
            jsonTryParse(message.value.toString(), {}),
          ),
        );
      },
    );
  });

export const dispatch = (task: Task, isSystemTask: boolean = false) =>
  producerClient.produce(
    isSystemTask
      ? kafkaTopicName.systemTask
      : `${kafkaTopicName.task}.${task.taskName}`,
    null,
    new Buffer(task.toJSON()),
    task.workflowId,
    Date.now(),
  );

// Use to send Retry, Failed, Reject event, Completed workflow, Dispatch task
export const sendEvent = (event: IEvent) =>
  producerClient.produce(
    kafkaTopicName.command,
    null,
    new Buffer(JSON.stringify(event)),
    event.workflowId,
    Date.now(),
  );
