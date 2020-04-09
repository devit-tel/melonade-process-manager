/* tslint:disable: max-func-body-length */

import {
  Event,
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
import { WorkflowDefinitionMemoryStore } from '../store/memory/workflowDefinition';
import { TaskInstanceMongooseStore } from '../store/mongoose/taskInstance';
import { TransactionInstanceMongooseStore } from '../store/mongoose/transactionInstance';
import { WorkflowInstanceMongooseStore } from '../store/mongoose/workflowInstance';
import { TaskInstanceRedisStore } from '../store/redis/taskInstance';
import { TransactionInstanceRedisStore } from '../store/redis/transactionInstance';
import { WorkflowInstanceRedisStore } from '../store/redis/workflowInstance';

const MONGODB_URL: string =
  process.env['MONGODB_URI'] ||
  `mongodb://127.0.0.1:27017/melonade-test-${Date.now()}`;

// @ts-ignore
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
const mockedSendUpdate = <jest.Mock<typeof kafka.sendUpdate>>kafka.sendUpdate;

const cleanMock = () => {
  storeSpies.map((spy: jest.SpyInstance<any>) => spy.mockClear());
  mockedDispatch.mockClear();
  mockedSendEvent.mockClear();
  mockedSendTimer.mockClear();
  mockedSendUpdate.mockClear();
};

// @ts-ignore
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

const WORKFLOW_DEFINITION: WorkflowDefinition.IWorkflowDefinition = {
  name: 'name',
  rev: 'rev',
  description: '',
  failureStrategy: State.WorkflowFailureStrategies.CompensateThenRetry,
  retry: {
    limit: WORKFLOW_RETRY_LIMIT,
  },
  outputParameters: {
    a: '${t1.output.a}',
    b: '${t2.output.b}',
    c: '${t3.output.c}',
  },
  tasks: [
    {
      name: 't1',
      taskReferenceName: 't1',
      inputParameters: {},
      type: Task.TaskTypes.Task,
    },
    {
      taskReferenceName: 'p1',
      parallelTasks: [
        [
          {
            type: Task.TaskTypes.Schedule,
            taskReferenceName: 'w1',
            inputParameters: {
              completedAfter: 100,
            },
          },
        ],
        [
          {
            name: 't2',
            taskReferenceName: 't2',
            inputParameters: {},
            type: Task.TaskTypes.Task,
          },
        ],
        [
          {
            type: Task.TaskTypes.SubTransaction,
            taskReferenceName: 's1',
            inputParameters: {
              workflowName: 'sub1',
              workflowRev: 'rev',
            },
          },
        ],
      ],
      inputParameters: {},
      type: Task.TaskTypes.Parallel,
    },
    {
      name: 't3',
      taskReferenceName: 't3',
      inputParameters: {},
      type: Task.TaskTypes.Task,
    },
    {
      type: Task.TaskTypes.Schedule,
      taskReferenceName: 'www',
      inputParameters: {
        completedAfter: 20000,
      },
    },
  ],
};

const SUB_WORKFLOW_1_DEFINITION: WorkflowDefinition.IWorkflowDefinition = {
  name: 'sub1',
  rev: 'rev',
  description: '',
  failureStrategy: State.WorkflowFailureStrategies.CompensateThenRetry,
  retry: {
    limit: WORKFLOW_RETRY_LIMIT,
  },
  outputParameters: {
    a: '${t1.output.a}',
    b: '${t2.output.b}',
    c: '${t3.output.c}',
  },
  tasks: [
    {
      name: 't1',
      taskReferenceName: 't1',
      inputParameters: {},
      type: Task.TaskTypes.Task,
    },
    {
      taskReferenceName: 'p1',
      parallelTasks: [
        [
          {
            taskReferenceName: 'd1',
            inputParameters: {},
            type: Task.TaskTypes.Decision,
            defaultDecision: [
              {
                name: 'd1_t1',
                taskReferenceName: 'd1_t1',
                inputParameters: {},
                type: Task.TaskTypes.Task,
              },
              {
                name: 'd1_t2',
                taskReferenceName: 'd1_t2',
                inputParameters: {},
                type: Task.TaskTypes.Task,
              },
            ],
            decisions: {},
          },
        ],
        [
          {
            type: Task.TaskTypes.SubTransaction,
            taskReferenceName: 's1',
            inputParameters: {
              workflowName: 'sub2',
              workflowRev: 'rev',
            },
          },
        ],
      ],
      inputParameters: {},
      type: Task.TaskTypes.Parallel,
    },
    {
      name: 't3',
      taskReferenceName: 't2',
      inputParameters: {},
      type: Task.TaskTypes.Task,
    },
    {
      type: Task.TaskTypes.Schedule,
      taskReferenceName: 'www',
      inputParameters: {
        completedAfter: 20000,
      },
    },
  ],
};

const SUB_WORKFLOW_2_DEFINITION: WorkflowDefinition.IWorkflowDefinition = {
  name: 'sub2',
  rev: 'rev',
  description: '',
  failureStrategy: State.WorkflowFailureStrategies.CompensateThenRetry,
  retry: {
    limit: WORKFLOW_RETRY_LIMIT,
  },
  outputParameters: {
    a: '${t1.output.a}',
    b: '${t2.output.b}',
    c: '${t3.output.c}',
  },
  tasks: [
    {
      name: 't1',
      taskReferenceName: 't1',
      inputParameters: {},
      type: Task.TaskTypes.Task,
    },
    {
      name: 't2',
      taskReferenceName: 't2',
      inputParameters: {},
      type: Task.TaskTypes.Task,
    },
    {
      name: 't3',
      taskReferenceName: 't3',
      inputParameters: {},
      type: Task.TaskTypes.Task,
    },
  ],
};

describe('Run transaction with sub transaction', () => {
  afterEach(cleanMock);

  // Do test each store type
  describe.each([
    {
      taskDefinitionStoreClient: new TaskDefinitionMemoryStore(),
      workflowDefinitionStoreClient: new WorkflowDefinitionMemoryStore(),
      taskInstanceStoreClient: new TaskInstanceRedisStore({}),
      workflowInstanceStoreClient: new WorkflowInstanceRedisStore({}),
      transactionInstanceStoreClient: new TransactionInstanceRedisStore({}),
    },
    {
      taskDefinitionStoreClient: new TaskDefinitionMemoryStore(),
      workflowDefinitionStoreClient: new WorkflowDefinitionMemoryStore(),
      taskInstanceStoreClient: new TaskInstanceMongooseStore(MONGODB_URL, {}),
      workflowInstanceStoreClient: new WorkflowInstanceMongooseStore(
        MONGODB_URL,
        {},
      ),
      transactionInstanceStoreClient: new TransactionInstanceMongooseStore(
        MONGODB_URL,
        {},
      ),
    },
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

    test('All task completed', async () => {
      const TRANSACTION_ID = 'run-subtransaction-1';
      const SUB_TRANSACTION_1_ID = `${TRANSACTION_ID}-s1`;
      const SUB_TRANSACTION_2_ID = `${SUB_TRANSACTION_1_ID}-s1`;

      let currentTask: Task.ITask;
      // Main workflow t1
      {
        await workflowDefinitionStore.create(WORKFLOW_DEFINITION);
        await workflowDefinitionStore.create(SUB_WORKFLOW_1_DEFINITION);
        await workflowDefinitionStore.create(SUB_WORKFLOW_2_DEFINITION);

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

        expect(mockedSendUpdate).toBeCalledTimes(0);
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
        currentTask = mockedDispatch.mock.calls[0][0];
        cleanMock();
        // ----------------------------------------------------------------
      }

      // Main workflow s1
      let p1Tasks: Task.ITask[];
      let w1Task: Task.ITask;
      {
        await updateTask(currentTask);

        expect(mockedSendEvent).toBeCalledTimes(11);
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

        // Start parallel
        expect(mockedSendEvent).toBeCalledWith(
          expect.objectContaining({
            type: 'TASK',
            details: expect.objectContaining({
              transactionId: TRANSACTION_ID,
              taskReferenceName: 'p1',
              status: State.TaskStates.Scheduled,
              type: Task.TaskTypes.Parallel,
            }),
            isError: false,
          }),
        );
        expect(mockedSendEvent).toBeCalledWith(
          expect.objectContaining({
            type: 'TASK',
            details: expect.objectContaining({
              transactionId: TRANSACTION_ID,
              taskReferenceName: 'w1',
              status: State.TaskStates.Scheduled,
              type: Task.TaskTypes.Schedule,
            }),
            isError: false,
          }),
        );
        // Sub transaction #1
        expect(mockedSendEvent).toBeCalledWith(
          expect.objectContaining({
            type: 'TASK',
            details: expect.objectContaining({
              transactionId: TRANSACTION_ID,
              taskReferenceName: 's1',
              status: State.TaskStates.Scheduled,
              type: Task.TaskTypes.SubTransaction,
            }),
            isError: false,
          }),
        );
        expect(mockedSendEvent).toBeCalledWith(
          expect.objectContaining({
            type: 'TRANSACTION',
            details: expect.objectContaining({
              transactionId: SUB_TRANSACTION_1_ID,
              status: State.TransactionStates.Running,
            }),
            isError: false,
          }),
        );
        expect(mockedSendEvent).toBeCalledWith(
          expect.objectContaining({
            type: 'WORKFLOW',
            details: expect.objectContaining({
              transactionId: SUB_TRANSACTION_1_ID,
              status: State.WorkflowStates.Running,
            }),
            isError: false,
          }),
        );
        expect(mockedSendEvent).toBeCalledWith(
          expect.objectContaining({
            type: 'TASK',
            details: expect.objectContaining({
              transactionId: SUB_TRANSACTION_1_ID,
              taskReferenceName: 't1',
              status: State.TaskStates.Scheduled,
              type: Task.TaskTypes.Task,
            }),
            isError: false,
          }),
        );
        expect(mockedSendEvent).toBeCalledWith(
          expect.objectContaining({
            type: 'TASK',
            details: expect.objectContaining({
              transactionId: TRANSACTION_ID,
              taskReferenceName: 's1',
              status: State.TaskStates.Inprogress,
              type: Task.TaskTypes.SubTransaction,
            }),
            isError: false,
          }),
        );
        expect(mockedSendEvent).toBeCalledWith(
          expect.objectContaining({
            type: 'TASK',
            details: expect.objectContaining({
              transactionId: TRANSACTION_ID,
              taskReferenceName: 't2',
              status: State.TaskStates.Scheduled,
              type: Task.TaskTypes.Task,
            }),
            isError: false,
          }),
        );
        expect(mockedSendEvent).toBeCalledWith(
          expect.objectContaining({
            type: 'TASK',
            details: expect.objectContaining({
              transactionId: TRANSACTION_ID,
              taskReferenceName: 'p1',
              status: State.TaskStates.Inprogress,
              type: Task.TaskTypes.Parallel,
            }),
            isError: false,
          }),
        );

        expect(mockedDispatch).toBeCalledTimes(2);
        expect(mockedDispatch).toBeCalledWith(
          expect.objectContaining({
            transactionId: TRANSACTION_ID,
            type: Task.TaskTypes.Task,
            taskReferenceName: 't2',
            status: State.TaskStates.Scheduled,
          }),
        );
        expect(mockedDispatch).toBeCalledWith(
          expect.objectContaining({
            transactionId: SUB_TRANSACTION_1_ID,
            type: Task.TaskTypes.Task,
            taskReferenceName: 't1',
            status: State.TaskStates.Scheduled,
          }),
        );

        expect(mockedSendTimer).toBeCalledTimes(1);

        expect(transactionInstanceStore.create).toBeCalledTimes(1);
        expect(transactionInstanceStore.update).toBeCalledTimes(0);
        expect(workflowInstanceStore.create).toBeCalledTimes(1);
        expect(workflowInstanceStore.update).toBeCalledTimes(0);
        expect(taskInstanceStore.create).toBeCalledTimes(5);
        expect(taskInstanceStore.update).toBeCalledTimes(3);
        expect(taskInstanceStore.reload).toBeCalledTimes(0);

        // ----------------------------------------------------------------
        // currentTask = mockedDispatch.mock.calls[0][0];
        p1Tasks = mockedDispatch.mock.calls.map((args: any[]) => args[0]);
        w1Task = mockedSendEvent.mock.calls.find(
          (args: [Event.AllEvent, any]) => {
            return (
              args[0].type === 'TASK' &&
              args[0].isError === false &&
              args[0].details.taskReferenceName === 'w1'
            );
          },
        )[0].details;

        cleanMock();
        // ----------------------------------------------------------------
      }

      // Parallel (t2, w1, s1)
      {
        // process t2
        {
          currentTask = p1Tasks.find(
            (task: Task.ITask) => task.taskReferenceName === 't2',
          );

          await updateTask(currentTask);
          expect(mockedSendEvent).toBeCalledTimes(2);

          expect(mockedSendEvent).toBeCalledWith(
            expect.objectContaining({
              type: 'TASK',
              details: expect.objectContaining({
                transactionId: TRANSACTION_ID,
                taskReferenceName: 't2',
                status: State.TaskStates.Inprogress,
                type: Task.TaskTypes.Task,
              }),
              isError: false,
            }),
          );
          expect(mockedSendEvent).toBeCalledWith(
            expect.objectContaining({
              type: 'TASK',
              details: expect.objectContaining({
                transactionId: TRANSACTION_ID,
                taskReferenceName: 't2',
                status: State.TaskStates.Completed,
                type: Task.TaskTypes.Task,
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
          expect(taskInstanceStore.update).toBeCalledTimes(2);
          expect(taskInstanceStore.reload).toBeCalledTimes(0);

          cleanMock();
        }

        // process w1
        {
          currentTask = w1Task;

          await updateTask(currentTask);
          expect(mockedSendEvent).toBeCalledTimes(2);

          expect(mockedSendEvent).toBeCalledWith(
            expect.objectContaining({
              type: 'TASK',
              details: expect.objectContaining({
                transactionId: TRANSACTION_ID,
                taskReferenceName: 'w1',
                status: State.TaskStates.Inprogress,
                type: Task.TaskTypes.Schedule,
              }),
              isError: false,
            }),
          );
          expect(mockedSendEvent).toBeCalledWith(
            expect.objectContaining({
              type: 'TASK',
              details: expect.objectContaining({
                transactionId: TRANSACTION_ID,
                taskReferenceName: 'w1',
                status: State.TaskStates.Completed,
                type: Task.TaskTypes.Schedule,
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
          expect(taskInstanceStore.update).toBeCalledTimes(2);
          expect(taskInstanceStore.reload).toBeCalledTimes(0);

          cleanMock();
        }

        // process s1
        {
          currentTask = p1Tasks.find(
            (task: Task.ITask) => task.taskReferenceName === 't1',
          );

          await updateTask(currentTask);
          expect(mockedSendEvent).toBeCalledTimes(12);

          expect(mockedSendEvent).toBeCalledWith(
            expect.objectContaining({
              type: 'TASK',
              details: expect.objectContaining({
                transactionId: SUB_TRANSACTION_1_ID,
                taskReferenceName: 't1',
                status: State.TaskStates.Inprogress,
                type: Task.TaskTypes.Task,
              }),
              isError: false,
            }),
          );
          expect(mockedSendEvent).toBeCalledWith(
            expect.objectContaining({
              type: 'TASK',
              details: expect.objectContaining({
                transactionId: SUB_TRANSACTION_1_ID,
                taskReferenceName: 't1',
                status: State.TaskStates.Completed,
                type: Task.TaskTypes.Task,
              }),
              isError: false,
            }),
          );

          // Start parallel
          expect(mockedSendEvent).toBeCalledWith(
            expect.objectContaining({
              type: 'TASK',
              details: expect.objectContaining({
                transactionId: SUB_TRANSACTION_1_ID,
                taskReferenceName: 'p1',
                status: State.TaskStates.Scheduled,
                type: Task.TaskTypes.Parallel,
              }),
              isError: false,
            }),
          );
          // Decision
          expect(mockedSendEvent).toBeCalledWith(
            expect.objectContaining({
              type: 'TASK',
              details: expect.objectContaining({
                transactionId: SUB_TRANSACTION_1_ID,
                taskReferenceName: 'd1',
                status: State.TaskStates.Scheduled,
                type: Task.TaskTypes.Decision,
              }),
              isError: false,
            }),
          );
          expect(mockedSendEvent).toBeCalledWith(
            expect.objectContaining({
              type: 'TASK',
              details: expect.objectContaining({
                transactionId: SUB_TRANSACTION_1_ID,
                taskReferenceName: 'd1_t1',
                status: State.TaskStates.Scheduled,
                type: Task.TaskTypes.Task,
              }),
              isError: false,
            }),
          );
          expect(mockedSendEvent).toBeCalledWith(
            expect.objectContaining({
              type: 'TASK',
              details: expect.objectContaining({
                transactionId: SUB_TRANSACTION_1_ID,
                taskReferenceName: 'd1',
                status: State.TaskStates.Inprogress,
                type: Task.TaskTypes.Decision,
              }),
              isError: false,
            }),
          );

          // Sub transaction #2
          expect(mockedSendEvent).toBeCalledWith(
            expect.objectContaining({
              type: 'TASK',
              details: expect.objectContaining({
                transactionId: SUB_TRANSACTION_1_ID,
                taskReferenceName: 's1',
                status: State.TaskStates.Scheduled,
                type: Task.TaskTypes.SubTransaction,
              }),
              isError: false,
            }),
          );
          expect(mockedSendEvent).toBeCalledWith(
            expect.objectContaining({
              type: 'TRANSACTION',
              details: expect.objectContaining({
                transactionId: SUB_TRANSACTION_2_ID,
                status: State.TransactionStates.Running,
              }),
              isError: false,
            }),
          );
          expect(mockedSendEvent).toBeCalledWith(
            expect.objectContaining({
              type: 'WORKFLOW',
              details: expect.objectContaining({
                transactionId: SUB_TRANSACTION_2_ID,
                status: State.WorkflowStates.Running,
              }),
              isError: false,
            }),
          );
          expect(mockedSendEvent).toBeCalledWith(
            expect.objectContaining({
              type: 'TASK',
              details: expect.objectContaining({
                transactionId: SUB_TRANSACTION_2_ID,
                taskReferenceName: 't1',
                status: State.TaskStates.Scheduled,
                type: Task.TaskTypes.Task,
              }),
              isError: false,
            }),
          );
          expect(mockedSendEvent).toBeCalledWith(
            expect.objectContaining({
              type: 'TASK',
              details: expect.objectContaining({
                transactionId: SUB_TRANSACTION_1_ID,
                taskReferenceName: 's1',
                status: State.TaskStates.Inprogress,
                type: Task.TaskTypes.SubTransaction,
              }),
              isError: false,
            }),
          );
          expect(mockedSendEvent).toBeCalledWith(
            expect.objectContaining({
              type: 'TASK',
              details: expect.objectContaining({
                transactionId: SUB_TRANSACTION_1_ID,
                taskReferenceName: 'p1',
                status: State.TaskStates.Inprogress,
                type: Task.TaskTypes.Parallel,
              }),
              isError: false,
            }),
          );

          expect(mockedDispatch).toBeCalledTimes(2);
          expect(mockedDispatch).toBeCalledWith(
            expect.objectContaining({
              transactionId: SUB_TRANSACTION_1_ID,
              type: Task.TaskTypes.Task,
              taskReferenceName: 'd1_t1',
              status: State.TaskStates.Scheduled,
            }),
          );
          expect(mockedDispatch).toBeCalledWith(
            expect.objectContaining({
              transactionId: SUB_TRANSACTION_2_ID,
              type: Task.TaskTypes.Task,
              taskReferenceName: 't1',
              status: State.TaskStates.Scheduled,
            }),
          );

          expect(mockedSendTimer).toBeCalledTimes(0);

          expect(transactionInstanceStore.create).toBeCalledTimes(1);
          expect(transactionInstanceStore.update).toBeCalledTimes(0);
          expect(workflowInstanceStore.create).toBeCalledTimes(1);
          expect(workflowInstanceStore.update).toBeCalledTimes(0);
          expect(taskInstanceStore.create).toBeCalledTimes(5);
          expect(taskInstanceStore.update).toBeCalledTimes(3);
          expect(taskInstanceStore.reload).toBeCalledTimes(0);
        }
      }
    });
  });
});
