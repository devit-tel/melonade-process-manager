import {
  State,
  Task,
  WorkflowDefinition,
} from '@melonade/melonade-declaration';
import * as kafka from '../kafka';
import * as state from '../state';
import {
  ITaskDefinitionStore,
  ITaskInstanceStore,
  ITransactionInstanceStore,
  IWorkflowDefinitionStore,
  IWorkflowInstanceStore,
  taskDefinitionStore,
  taskInstanceStore,
  transactionInstanceStore,
  workflowDefinitionStore,
  workflowInstanceStore,
} from '../store';
import { TaskDefinitionMemoryStore } from '../store/memory/taskDefinition';
import { TaskInstanceMemoryStore } from '../store/memory/taskInstance';
import { TransactionInstanceMemoryStore } from '../store/memory/transactionInstance';
import { WorkflowDefinitionMemoryStore } from '../store/memory/workflowDefinition';
import { WorkflowInstanceMemoryStore } from '../store/memory/workflowInstance';
import { TaskInstanceRedisStore } from '../store/redis/taskInstance';
import { TransactionInstanceRedisStore } from '../store/redis/transactionInstance';
import { WorkflowInstanceRedisStore } from '../store/redis/workflowInstance';

jest.mock('../kafka');
jest.mock('ioredis', () => {
  const Redis = require('ioredis-mock');
  if (typeof Redis === 'object') {
    // the first mock is an ioredis shim because ioredis-mock depends on it
    // https://github.com/stipsan/ioredis-mock/blob/master/src/index.js#L101-L111
    return {
      Command: { _transformer: { argument: {}, reply: {} } },
    };
  }
  // second mock for our code
  return { default: Redis };
});

const storeSpies = [
  jest.spyOn(transactionInstanceStore, 'create'),
  jest.spyOn(transactionInstanceStore, 'update'),
  jest.spyOn(workflowInstanceStore, 'create'),
  jest.spyOn(workflowInstanceStore, 'update'),
  jest.spyOn(taskInstanceStore, 'create'),
  jest.spyOn(taskInstanceStore, 'update'),
];

const mockedDispatch = <jest.Mock<typeof kafka.dispatch>>kafka.dispatch;

afterEach(() => {
  storeSpies.map((spy: jest.SpyInstance<any>) => spy.mockClear());
  mockedDispatch.mockClear();
});

// Do test each store type
describe.each([
  {
    taskDefinitionStoreClient: new TaskDefinitionMemoryStore(),
    workflowDefinitionStoreClient: new WorkflowDefinitionMemoryStore(),
    taskInstanceStoreClient: new TaskInstanceMemoryStore(),
    workflowInstanceStoreClient: new WorkflowInstanceMemoryStore(),
    transactionInstanceStoreClient: new TransactionInstanceMemoryStore(),
  },
  {
    taskDefinitionStoreClient: new TaskDefinitionMemoryStore(),
    workflowDefinitionStoreClient: new WorkflowDefinitionMemoryStore(),
    taskInstanceStoreClient: new TaskInstanceRedisStore({}),
    workflowInstanceStoreClient: new WorkflowInstanceRedisStore({}),
    transactionInstanceStoreClient: new TransactionInstanceRedisStore({}),
  },
])(
  'Ideal workflow for (%p)',
  // tslint:disable-next-line: max-func-body-length
  ({
    taskDefinitionStoreClient,
    workflowDefinitionStoreClient,
    taskInstanceStoreClient,
    workflowInstanceStoreClient,
    transactionInstanceStoreClient,
  }: {
    taskDefinitionStoreClient: ITaskDefinitionStore;
    workflowDefinitionStoreClient: IWorkflowDefinitionStore;
    taskInstanceStoreClient: ITaskInstanceStore;
    workflowInstanceStoreClient: IWorkflowInstanceStore;
    transactionInstanceStoreClient: ITransactionInstanceStore;
  }) => {
    beforeAll(() => {
      taskDefinitionStore.setClient(taskDefinitionStoreClient);
      workflowDefinitionStore.setClient(workflowDefinitionStoreClient);
      taskInstanceStore.setClient(taskInstanceStoreClient);
      workflowInstanceStore.setClient(workflowInstanceStoreClient);
      transactionInstanceStore.setClient(transactionInstanceStoreClient);
    });

    const dispatchedTasks: Task.ITask[] = [];
    test('Start transaction and dispatch task', async () => {
      const SAMPLE_WORKFLOW: WorkflowDefinition.IWorkflowDefinition = {
        name: 'name',
        rev: 'rev',
        description: '',
        failureStrategy: State.WorkflowFailureStrategies.Failed,
        outputParameters: {
          a: '${t1.output.a}',
          b: '${t2.output.b}',
          c: '${t3.output.c}',
        },
        tasks: [
          {
            name: 't1',
            taskReferenceName: 't1',
            inputParameters: { a: '${workflow.input.a}' },
            type: Task.TaskTypes.Task,
          },
          {
            name: 't2',
            taskReferenceName: 't2',
            inputParameters: { b: '${t1.output.b}' },
            type: Task.TaskTypes.Task,
          },
          {
            name: 't3',
            taskReferenceName: 't3',
            inputParameters: { c: '${t2.output.c}' },
            type: Task.TaskTypes.Task,
          },
        ],
      };

      await transactionInstanceStore.create(
        'someTransactionId',
        SAMPLE_WORKFLOW,
        {
          a: 'hello',
        },
      );
      dispatchedTasks.push(mockedDispatch.mock.calls[0][0]);
      expect(mockedDispatch).toBeCalledTimes(1);
      expect(transactionInstanceStore.create).toBeCalledTimes(1);
      expect(transactionInstanceStore.update).toBeCalledTimes(0);
      expect(workflowInstanceStore.create).toBeCalledTimes(1);
      expect(workflowInstanceStore.update).toBeCalledTimes(0);
      expect(taskInstanceStore.create).toBeCalledTimes(1);
      expect(taskInstanceStore.update).toBeCalledTimes(0);
    });

    test('Acknowledge and Finish 1st task', async () => {
      // next task only dispatched if this task completed
      const currentTask = dispatchedTasks[0];
      await state.processUpdatedTasks([
        {
          taskId: currentTask.taskId,
          isSystem: false,
          transactionId: currentTask.transactionId,
          status: State.TaskStates.Inprogress,
        },
      ]);

      expect(mockedDispatch).toBeCalledTimes(0);
      await state.processUpdatedTasks([
        {
          taskId: currentTask.taskId,
          isSystem: false,
          transactionId: currentTask.transactionId,
          status: State.TaskStates.Completed,
        },
      ]);

      dispatchedTasks.push(mockedDispatch.mock.calls[0][0]);

      expect(mockedDispatch).toBeCalledTimes(1);
      expect(transactionInstanceStore.create).toBeCalledTimes(0);
      expect(transactionInstanceStore.update).toBeCalledTimes(0);
      expect(workflowInstanceStore.create).toBeCalledTimes(0);
      expect(workflowInstanceStore.update).toBeCalledTimes(0);
      expect(taskInstanceStore.create).toBeCalledTimes(1);
      expect(taskInstanceStore.update).toBeCalledTimes(2);
    });

    test('Acknowledge and Finish 2nd task', async () => {
      // next task only dispatched if this task completed
      const currentTask = dispatchedTasks[1];
      await state.processUpdatedTasks([
        {
          taskId: currentTask.taskId,
          isSystem: false,
          transactionId: currentTask.transactionId,
          status: State.TaskStates.Inprogress,
        },
      ]);

      expect(mockedDispatch).toBeCalledTimes(0);
      await state.processUpdatedTasks([
        {
          taskId: currentTask.taskId,
          isSystem: false,
          transactionId: currentTask.transactionId,
          status: State.TaskStates.Completed,
        },
      ]);

      dispatchedTasks.push(mockedDispatch.mock.calls[0][0]);

      expect(mockedDispatch).toBeCalledTimes(1);
      expect(transactionInstanceStore.create).toBeCalledTimes(0);
      expect(transactionInstanceStore.update).toBeCalledTimes(0);
      expect(workflowInstanceStore.create).toBeCalledTimes(0);
      expect(workflowInstanceStore.update).toBeCalledTimes(0);
      expect(taskInstanceStore.create).toBeCalledTimes(1);
      expect(taskInstanceStore.update).toBeCalledTimes(2);
    });

    test('Transaction, workflow must in running state', async () => {
      const transaction = await transactionInstanceStore.get(
        'someTransactionId',
      );
      expect(transaction.status).toEqual(State.TransactionStates.Running);
    });

    test('Acknowledge and Finish 3th task', async () => {
      // This is last task of workflow, no more task to dispatch
      const currentTask = dispatchedTasks[2];
      await state.processUpdatedTasks([
        {
          taskId: currentTask.taskId,
          isSystem: false,
          transactionId: currentTask.transactionId,
          status: State.TaskStates.Inprogress,
        },
      ]);

      expect(mockedDispatch).toBeCalledTimes(0);
      await state.processUpdatedTasks([
        {
          taskId: currentTask.taskId,
          isSystem: false,
          transactionId: currentTask.transactionId,
          status: State.TaskStates.Completed,
        },
      ]);

      expect(mockedDispatch).toBeCalledTimes(0);
      expect(transactionInstanceStore.create).toBeCalledTimes(0);
      expect(transactionInstanceStore.update).toBeCalledTimes(1);
      expect(workflowInstanceStore.create).toBeCalledTimes(0);
      expect(workflowInstanceStore.update).toBeCalledTimes(1);
      expect(taskInstanceStore.create).toBeCalledTimes(0);
      expect(taskInstanceStore.update).toBeCalledTimes(2);
    });

    test('Instance data must be clean up', async () => {
      const transaction = await transactionInstanceStore.get(
        'someTransactionId',
      );
      expect(transaction).toEqual(undefined);
    });
  },
);
