/* tslint:disable: max-func-body-length */

import {
  State,
  Task,
  WorkflowDefinition,
} from '@melonade/melonade-declaration';
import * as R from 'ramda';
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

// const mongodbUrl: string = `mongodb://127.0.0.1:51553/melonade-test`;

const TASK_RETRY_LIMIT = 3;
const WORKFLOW_RETRY_LIMIT = 3;

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
  jest.spyOn(taskInstanceStore, 'reload'),
];

const mockedDispatch = <jest.Mock<typeof kafka.dispatch>>kafka.dispatch;
const mockedSendEvent = <jest.Mock<typeof kafka.sendEvent>>kafka.sendEvent;
const mockedSendTimer = <jest.Mock<typeof kafka.sendTimer>>kafka.sendTimer;

const cleanMock = () => {
  storeSpies.map((spy: jest.SpyInstance<any>) => spy.mockClear());
  mockedDispatch.mockClear();
  mockedSendEvent.mockClear();
  mockedSendTimer.mockClear();
};

const updateTask = async (
  currentTask: Task.ITask,
  status: State.TaskStates = State.TaskStates.Completed,
) => {
  // Simulate client acknowledgement
  await state.processUpdateTasks([
    {
      taskId: currentTask.taskId,
      isSystem: false,
      transactionId: currentTask.transactionId,
      status: State.TaskStates.Inprogress,
    },
  ]);

  expect(mockedDispatch).toBeCalledTimes(0);

  await state.processUpdateTasks([
    {
      taskId: currentTask.taskId,
      isSystem: false,
      transactionId: currentTask.transactionId,
      status,
    },
  ]);
};

interface IAllStoreType {
  taskDefinitionStoreClient: ITaskDefinitionStore;
  workflowDefinitionStoreClient: IWorkflowDefinitionStore;
  taskInstanceStoreClient: ITaskInstanceStore;
  workflowInstanceStoreClient: IWorkflowInstanceStore;
  transactionInstanceStoreClient: ITransactionInstanceStore;
}

describe('Run simple workflow', () => {
  afterEach(cleanMock);

  // Do test each store type
  describe.each([
    {
      taskDefinitionStoreClient: new TaskDefinitionMemoryStore(),
      workflowDefinitionStoreClient: new WorkflowDefinitionMemoryStore(),
      taskInstanceStoreClient: new TaskInstanceMemoryStore(),
      workflowInstanceStoreClient: new WorkflowInstanceMemoryStore(),
      transactionInstanceStoreClient: new TransactionInstanceMemoryStore(),
    },
    // {
    //   taskDefinitionStoreClient: new TaskDefinitionMemoryStore(),
    //   workflowDefinitionStoreClient: new WorkflowDefinitionMemoryStore(),
    //   taskInstanceStoreClient: new TaskInstanceRedisStore({}),
    //   workflowInstanceStoreClient: new WorkflowInstanceRedisStore({}),
    //   transactionInstanceStoreClient: new TransactionInstanceRedisStore({}),
    // },
    // {
    //   taskDefinitionStoreClient: new TaskDefinitionMemoryStore(),
    //   workflowDefinitionStoreClient: new WorkflowDefinitionMemoryStore(),
    //   taskInstanceStoreClient: new TaskInstanceMongooseStore(mongodbUrl, {}),
    //   workflowInstanceStoreClient: new WorkflowInstanceMongooseStore(
    //     mongodbUrl,
    //     {},
    //   ),
    //   transactionInstanceStoreClient: new TransactionInstanceMongooseStore(
    //     mongodbUrl,
    //     {},
    //   ),
    // },
  ])('Integate test store (%p)', (allStores: IAllStoreType): void => {
    // Change store type for each test
    beforeAll(() => {
      taskDefinitionStore.setClient(allStores.taskDefinitionStoreClient);
      workflowDefinitionStore.setClient(
        allStores.workflowDefinitionStoreClient,
      );
      taskInstanceStore.setClient(allStores.taskInstanceStoreClient);
      workflowInstanceStore.setClient(allStores.workflowInstanceStoreClient);
      transactionInstanceStore.setClient(
        allStores.transactionInstanceStoreClient,
      );
    });

    const WORKFLOW_DEFINITION: WorkflowDefinition.IWorkflowDefinition = {
      name: 'name',
      rev: 'rev',
      description: '',
      failureStrategy: State.WorkflowFailureStrategies.Failed,
      retry: {
        limit: WORKFLOW_RETRY_LIMIT,
      },
      outputParameters: {
        a: '${t1.output.a}',
        b: '${t2.output.b}',
        c: '${t3.output.c}',
        case: 'case1',
      },
      tasks: [
        {
          name: 't1',
          taskReferenceName: 't1',
          inputParameters: { a: '${workflow.input.a}' },
          type: Task.TaskTypes.Task,
        },
        {
          name: 'p2',
          taskReferenceName: 'p2',
          inputParameters: {},
          type: Task.TaskTypes.Parallel,
          parallelTasks: [
            [
              {
                name: 'p2_1_t1',
                taskReferenceName: 'p2_1_t1',
                inputParameters: { a: '${workflow.input.a}' },
                type: Task.TaskTypes.Task,
                retry: {
                  delay: 0,
                  limit: TASK_RETRY_LIMIT,
                },
              },
              {
                name: 'p2_1_t2',
                taskReferenceName: 'p2_1_t2',
                inputParameters: { a: '${workflow.input.a}' },
                type: Task.TaskTypes.Task,
                retry: {
                  delay: 0,
                  limit: TASK_RETRY_LIMIT,
                },
              },
            ],
            [
              {
                name: 'p2_2_d1',
                taskReferenceName: 'p2_2_d1',
                inputParameters: { case: '${workflow.input.case}' },
                type: Task.TaskTypes.Decision,
                defaultDecision: [
                  {
                    name: 'p2_2_d1_default_t1',
                    taskReferenceName: 'p2_2_d1_default_t1',
                    inputParameters: { c: '${workflow.input.c}' },
                    type: Task.TaskTypes.Task,
                    retry: {
                      delay: 0,
                      limit: TASK_RETRY_LIMIT,
                    },
                  },
                ],
                decisions: {
                  case1: [
                    {
                      name: 'p2_2_d1_case1_t1',
                      taskReferenceName: 'p2_2_d1_case1_t1',
                      inputParameters: { c: '${workflow.input.c}' },
                      type: Task.TaskTypes.Task,
                      retry: {
                        delay: 0,
                        limit: TASK_RETRY_LIMIT,
                      },
                    },
                  ],
                  case2: [
                    {
                      name: 'p2_2_d1_case2_t1',
                      taskReferenceName: 'p2_2_d1_case2_t1',
                      inputParameters: { c: '${workflow.input.c}' },
                      type: Task.TaskTypes.Task,
                      retry: {
                        delay: 0,
                        limit: TASK_RETRY_LIMIT,
                      },
                    },
                  ],
                },
              },
            ],
          ],
        },
        {
          name: 't3',
          taskReferenceName: 't3',
          inputParameters: { c: '${workflow.input.c}' },
          type: Task.TaskTypes.Task,
        },
      ],
    };

    test('All task completed (default case)', async () => {
      const TRANSACTION_ID = 'ALL_TASK_COMPLETED_DEFAULT_CASE';
      let currentTasks: Task.ITask[];

      await transactionInstanceStore.create(
        TRANSACTION_ID,
        WORKFLOW_DEFINITION,
        {
          a: 'hello',
        },
      );

      expect(mockedSendEvent).toBeCalledTimes(3);
      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TRANSACTION',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            status: State.TransactionStates.Running,
          }),
          isError: false,
        }),
      );
      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'WORKFLOW',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            status: State.WorkflowStates.Running,
          }),
          isError: false,
        }),
      );
      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TASK',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            taskReferenceName: 't1',
            status: State.TaskStates.Scheduled,
          }),
          isError: false,
        }),
      );

      expect(mockedDispatch).toBeCalledTimes(1);
      expect(mockedDispatch).toBeCalledWith(
        expect.objectContaining({
          type: Task.TaskTypes.Task,
          taskReferenceName: 't1',
          status: State.TaskStates.Scheduled,
        }),
      );
      expect(transactionInstanceStore.create).toBeCalledTimes(1);
      expect(transactionInstanceStore.update).toBeCalledTimes(0);
      expect(workflowInstanceStore.create).toBeCalledTimes(1);
      expect(workflowInstanceStore.update).toBeCalledTimes(0);
      expect(taskInstanceStore.create).toBeCalledTimes(1);
      expect(taskInstanceStore.update).toBeCalledTimes(0);
      expect(taskInstanceStore.reload).toBeCalledTimes(0);

      // ----------------------------------------------------------------
      currentTasks = mockedDispatch.mock.calls.map(R.head);
      cleanMock();
      // ----------------------------------------------------------------

      await updateTask(currentTasks[0]);

      expect(mockedSendEvent).toBeCalledTimes(8);
      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TASK',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            taskReferenceName: 't1',
            status: State.TaskStates.Inprogress,
          }),
          isError: false,
        }),
      );
      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TASK',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            taskReferenceName: 't1',
            status: State.TaskStates.Completed,
          }),
          isError: false,
        }),
      );
      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TASK',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            taskReferenceName: 'p2',
            status: State.TaskStates.Scheduled,
          }),
          isError: false,
        }),
      );
      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TASK',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            taskReferenceName: 'p2',
            status: State.TaskStates.Inprogress,
          }),
          isError: false,
        }),
      );
      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TASK',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            taskReferenceName: 'p2_1_t1',
            status: State.TaskStates.Scheduled,
          }),
          isError: false,
        }),
      );
      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TASK',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            taskReferenceName: 'p2_2_d1',
            status: State.TaskStates.Scheduled,
          }),
          isError: false,
        }),
      );
      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TASK',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            taskReferenceName: 'p2_2_d1',
            status: State.TaskStates.Inprogress,
          }),
          isError: false,
        }),
      );
      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TASK',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            taskReferenceName: 'p2_2_d1_default_t1',
            status: State.TaskStates.Scheduled,
          }),
          isError: false,
        }),
      );

      expect(mockedDispatch).toBeCalledTimes(2);
      expect(mockedDispatch).toBeCalledWith(
        expect.objectContaining({
          type: Task.TaskTypes.Task,
          taskReferenceName: 'p2_1_t1',
          status: State.TaskStates.Scheduled,
        }),
      );
      expect(mockedDispatch).toBeCalledWith(
        expect.objectContaining({
          type: Task.TaskTypes.Task,
          taskReferenceName: 'p2_2_d1_default_t1',
          status: State.TaskStates.Scheduled,
        }),
      );

      expect(transactionInstanceStore.create).toBeCalledTimes(0);
      expect(transactionInstanceStore.update).toBeCalledTimes(0);
      expect(workflowInstanceStore.create).toBeCalledTimes(0);
      expect(workflowInstanceStore.update).toBeCalledTimes(0);
      expect(taskInstanceStore.create).toBeCalledTimes(4);
      expect(taskInstanceStore.update).toBeCalledTimes(2);
      expect(taskInstanceStore.reload).toBeCalledTimes(0);

      // ----------------------------------------------------------------
      currentTasks = mockedDispatch.mock.calls.map(R.head);
      cleanMock();
      // ----------------------------------------------------------------

      await updateTask(currentTasks[1]);

      expect(mockedSendEvent).toBeCalledTimes(3);
      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TASK',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            taskReferenceName: 'p2_2_d1_default_t1',
            status: State.TaskStates.Inprogress,
          }),
          isError: false,
        }),
      );
      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TASK',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            taskReferenceName: 'p2_2_d1_default_t1',
            status: State.TaskStates.Completed,
          }),
          isError: false,
        }),
      );
      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TASK',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            taskReferenceName: 'p2_2_d1',
            status: State.TaskStates.Completed,
          }),
          isError: false,
        }),
      );

      expect(mockedDispatch).toBeCalledTimes(0);

      expect(transactionInstanceStore.create).toBeCalledTimes(0);
      expect(transactionInstanceStore.update).toBeCalledTimes(0);
      expect(workflowInstanceStore.create).toBeCalledTimes(0);
      expect(workflowInstanceStore.update).toBeCalledTimes(0);
      expect(taskInstanceStore.create).toBeCalledTimes(0);
      expect(taskInstanceStore.update).toBeCalledTimes(3);
      expect(taskInstanceStore.reload).toBeCalledTimes(0);

      // ----------------------------------------------------------------
      cleanMock();
      // ----------------------------------------------------------------

      await updateTask(currentTasks[0]);

      expect(mockedSendEvent).toBeCalledTimes(3);
      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TASK',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            taskReferenceName: 'p2_1_t1',
            status: State.TaskStates.Inprogress,
          }),
          isError: false,
        }),
      );
      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TASK',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            taskReferenceName: 'p2_1_t1',
            status: State.TaskStates.Completed,
          }),
          isError: false,
        }),
      );
      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TASK',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            taskReferenceName: 'p2_1_t2',
            status: State.TaskStates.Scheduled,
          }),
          isError: false,
        }),
      );

      expect(mockedDispatch).toBeCalledTimes(1);
      expect(mockedDispatch).toBeCalledWith(
        expect.objectContaining({
          type: Task.TaskTypes.Task,
          taskReferenceName: 'p2_1_t2',
          status: State.TaskStates.Scheduled,
        }),
      );

      expect(transactionInstanceStore.create).toBeCalledTimes(0);
      expect(transactionInstanceStore.update).toBeCalledTimes(0);
      expect(workflowInstanceStore.create).toBeCalledTimes(0);
      expect(workflowInstanceStore.update).toBeCalledTimes(0);
      expect(taskInstanceStore.create).toBeCalledTimes(1);
      expect(taskInstanceStore.update).toBeCalledTimes(2);
      expect(taskInstanceStore.reload).toBeCalledTimes(0);

      // ----------------------------------------------------------------
      currentTasks = mockedDispatch.mock.calls.map(R.head);
      cleanMock();
      // ----------------------------------------------------------------

      await updateTask(currentTasks[0]);

      expect(mockedSendEvent).toBeCalledTimes(4);
      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TASK',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            taskReferenceName: 'p2_1_t2',
            status: State.TaskStates.Inprogress,
          }),
          isError: false,
        }),
      );
      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TASK',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            taskReferenceName: 'p2_1_t2',
            status: State.TaskStates.Completed,
          }),
          isError: false,
        }),
      );
      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TASK',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            taskReferenceName: 'p2',
            status: State.TaskStates.Completed,
          }),
          isError: false,
        }),
      );
      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TASK',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            taskReferenceName: 't3',
            status: State.TaskStates.Scheduled,
          }),
          isError: false,
        }),
      );

      expect(mockedDispatch).toBeCalledTimes(1);
      expect(mockedDispatch).toBeCalledWith(
        expect.objectContaining({
          type: Task.TaskTypes.Task,
          taskReferenceName: 't3',
          status: State.TaskStates.Scheduled,
        }),
      );

      expect(transactionInstanceStore.create).toBeCalledTimes(0);
      expect(transactionInstanceStore.update).toBeCalledTimes(0);
      expect(workflowInstanceStore.create).toBeCalledTimes(0);
      expect(workflowInstanceStore.update).toBeCalledTimes(0);
      expect(taskInstanceStore.create).toBeCalledTimes(1);
      expect(taskInstanceStore.update).toBeCalledTimes(3);
      expect(taskInstanceStore.reload).toBeCalledTimes(0);

      // ----------------------------------------------------------------
      currentTasks = mockedDispatch.mock.calls.map(R.head);
      cleanMock();
      // ----------------------------------------------------------------

      await updateTask(currentTasks[0]);

      expect(mockedSendEvent).toBeCalledTimes(4);
      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TASK',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            taskReferenceName: 't3',
            status: State.TaskStates.Inprogress,
          }),
          isError: false,
        }),
      );
      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TASK',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            taskReferenceName: 't3',
            status: State.TaskStates.Completed,
          }),
          isError: false,
        }),
      );
      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'WORKFLOW',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            status: State.WorkflowStates.Completed,
          }),
          isError: false,
        }),
      );
      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TRANSACTION',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            status: State.TransactionStates.Completed,
          }),
          isError: false,
        }),
      );

      expect(mockedDispatch).toBeCalledTimes(0);

      expect(transactionInstanceStore.create).toBeCalledTimes(0);
      expect(transactionInstanceStore.update).toBeCalledTimes(1);
      expect(workflowInstanceStore.create).toBeCalledTimes(0);
      expect(workflowInstanceStore.update).toBeCalledTimes(1);
      expect(taskInstanceStore.create).toBeCalledTimes(0);
      expect(taskInstanceStore.update).toBeCalledTimes(2);
      expect(taskInstanceStore.reload).toBeCalledTimes(0);

      // ----------------------------------------------------------------
      cleanMock();
      // ----------------------------------------------------------------
    });

    test('task t3 failed 1 time with failureStrategy = Failed', async () => {});

    test('task t3 failed 4 time with failureStrategy = Failed', async () => {});

    test('task t3 failed 4 time with failureStrategy = Compensate', async () => {});

    test('task t3 failed 4 time with failureStrategy = Compensate but compensate task failed', async () => {});

    test('task t3 failed 4 time with failureStrategy = CompensateThenRetry and completed in 2nd try', async () => {});

    test('task t3 failed 4 time with failureStrategy = CompensateThenRetry but still failed after 4 retry', async () => {});
  });
});
