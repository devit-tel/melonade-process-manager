/* tslint:disable: max-func-body-length */

import {
  Event,
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

//const TASK_RETRY_LIMIT = 3;
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
  jest.clearAllMocks();
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

const getEventsTaskByTaskRef = (taskReferenceName: string) =>
  mockedSendEvent.mock.calls.find((args: [Event.AllEvent, any]) => {
    return (
      args[0].type === 'TASK' &&
      args[0].isError === false &&
      args[0].details.taskReferenceName === taskReferenceName
    );
  })[0].details;

interface IAllStoreType {
  taskDefinitionStoreClient: ITaskDefinitionStore;
  workflowDefinitionStoreClient: IWorkflowDefinitionStore;
  taskInstanceStoreClient: ITaskInstanceStore;
  workflowInstanceStoreClient: IWorkflowInstanceStore;
  transactionInstanceStoreClient: ITransactionInstanceStore;
}

describe('Run simple Dynamic Tasks workflow', () => {
  afterEach(cleanMock);

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
  ])('Integrate test store (%p)', (allStores: IAllStoreType): void => {
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

      taskDefinitionStore.create({
        name: 'subt1',
        description: 'description',
        ackTimeout: 0,
        timeout: 0,
      });

      taskDefinitionStore.create({
        name: 'subt2',
        description: 'description',
        ackTimeout: 0,
        timeout: 0,
      });

      taskDefinitionStore.create({
        name: 'subt3',
        description: 'description',
        ackTimeout: 0,
        timeout: 0,
      });

      taskDefinitionStore.create({
        name: 't1',
        description: 'description',
        ackTimeout: 0,
        timeout: 0,
      });

      taskDefinitionStore.create({
        name: 't3',
        description: 'description',
        ackTimeout: 0,
        timeout: 0,
      });
    });

    const WORKFLOW_DEFINITION: WorkflowDefinition.IWorkflowDefinition = {
      name: 'name',
      rev: 'rev',
      description: '',
      failureStrategy: State.WorkflowFailureStrategies.Failed,
      retry: {
        limit: WORKFLOW_RETRY_LIMIT,
      },
      outputParameters: {},
      tasks: [
        {
          name: 't1',
          taskReferenceName: 't1',
          inputParameters: {},
          type: Task.TaskTypes.Task,
        },
        {
          taskReferenceName: 'd1',
          type: Task.TaskTypes.DynamicTask,
          dynamicTasks: [],
          inputParameters: {
            tasks: '${workflow.input.runTasks}',
          },
        },
        {
          name: 't3',
          taskReferenceName: 't3',
          inputParameters: {},
          type: Task.TaskTypes.Task,
        },
      ],
    };

    const SIMPLE_DYNAMIC_CHILD_TASKS = [
      {
        name: 'subt1',
        taskReferenceName: 'subt1',
        inputParameters: {},
        type: Task.TaskTypes.Task,
      },
      {
        name: 'subt2',
        taskReferenceName: 'subt2',
        inputParameters: {},
        type: Task.TaskTypes.Task,
      },
      {
        name: 'subt3',
        taskReferenceName: 'subt3',
        inputParameters: {},
        type: Task.TaskTypes.Task,
      },
    ];

    test('All task completed', async () => {
      const TRANSACTION_ID = 'ALL_TASK_COMPLETED';
      let currentTasks: Task.ITask[];

      await transactionInstanceStore.create(
        TRANSACTION_ID,
        WORKFLOW_DEFINITION,
        {
          runTasks: SIMPLE_DYNAMIC_CHILD_TASKS,
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

      currentTasks = mockedDispatch.mock.calls.map(R.head);
      cleanMock();

      await updateTask(currentTasks[0]);

      expect(mockedSendEvent).toBeCalledTimes(5);
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
            taskReferenceName: 'd1',
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
            taskReferenceName: 'd1',
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
            taskReferenceName: 'subt1',
            status: State.TaskStates.Scheduled,
          }),
          isError: false,
        }),
      );

      expect(mockedDispatch).toBeCalledTimes(1);
      expect(mockedDispatch).toBeCalledWith(
        expect.objectContaining({
          type: Task.TaskTypes.Task,
          taskReferenceName: 'subt1',
          status: State.TaskStates.Scheduled,
        }),
      );

      expect(transactionInstanceStore.create).toBeCalledTimes(0);
      expect(transactionInstanceStore.update).toBeCalledTimes(0);
      expect(workflowInstanceStore.create).toBeCalledTimes(0);
      expect(workflowInstanceStore.update).toBeCalledTimes(0);
      expect(taskInstanceStore.create).toBeCalledTimes(2);
      expect(taskInstanceStore.update).toBeCalledTimes(2);
      expect(taskInstanceStore.reload).toBeCalledTimes(0);

      currentTasks = mockedDispatch.mock.calls.map(R.head);
      const d1_subt1 = getEventsTaskByTaskRef('subt1');
      cleanMock();

      await updateTask(d1_subt1);

      expect(mockedSendEvent).toBeCalledTimes(3);
      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TASK',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            taskReferenceName: 'subt1',
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
            taskReferenceName: 'subt1',
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
            taskReferenceName: 'subt2',
            status: State.TaskStates.Scheduled,
          }),
          isError: false,
        }),
      );

      expect(mockedDispatch).toBeCalledTimes(1);
      expect(mockedDispatch).toBeCalledWith(
        expect.objectContaining({
          type: Task.TaskTypes.Task,
          taskReferenceName: 'subt2',
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

      currentTasks = mockedDispatch.mock.calls.map(R.head);
      const d1_subt2 = getEventsTaskByTaskRef('subt2');
      cleanMock();

      await updateTask(d1_subt2);

      expect(mockedSendEvent).toBeCalledTimes(3);
      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TASK',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            taskReferenceName: 'subt2',
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
            taskReferenceName: 'subt2',
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
            taskReferenceName: 'subt3',
            status: State.TaskStates.Scheduled,
          }),
          isError: false,
        }),
      );

      expect(mockedDispatch).toBeCalledTimes(1);
      expect(mockedDispatch).toBeCalledWith(
        expect.objectContaining({
          type: Task.TaskTypes.Task,
          taskReferenceName: 'subt3',
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

      currentTasks = mockedDispatch.mock.calls.map(R.head);
      const d1_subt3 = getEventsTaskByTaskRef('subt3');
      cleanMock();

      await updateTask(d1_subt3);

      expect(mockedSendEvent).toBeCalledTimes(4);

      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TASK',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            taskReferenceName: 'subt3',
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
            taskReferenceName: 'subt3',
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
            taskReferenceName: 'd1',
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

      currentTasks = mockedDispatch.mock.calls.map(R.head);
      const t3 = getEventsTaskByTaskRef('t3');
      cleanMock();

      await updateTask(t3);

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
          type: 'TRANSACTION',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            status: State.TransactionStates.Completed,
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

      expect(mockedDispatch).toBeCalledTimes(0);
      expect(transactionInstanceStore.create).toBeCalledTimes(0);
      expect(transactionInstanceStore.update).toBeCalledTimes(1);
      expect(workflowInstanceStore.create).toBeCalledTimes(0);
      expect(workflowInstanceStore.update).toBeCalledTimes(1);
      expect(taskInstanceStore.create).toBeCalledTimes(0);
      expect(taskInstanceStore.update).toBeCalledTimes(2);
      expect(taskInstanceStore.reload).toBeCalledTimes(0);

      cleanMock();
    });
  });
});

describe('Dynamic of dynamic tasks', () => {
  afterEach(cleanMock);

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
  ])('Integrate test store (%p)', (allStores: IAllStoreType): void => {
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

      taskDefinitionStore.create({
        name: 'subt1',
        description: 'description',
        ackTimeout: 0,
        timeout: 0,
      });

      taskDefinitionStore.create({
        name: 'subt2',
        description: 'description',
        ackTimeout: 0,
        timeout: 0,
      });

      taskDefinitionStore.create({
        name: 'subt3',
        description: 'description',
        ackTimeout: 0,
        timeout: 0,
      });

      taskDefinitionStore.create({
        name: 'subt21',
        description: 'description',
        ackTimeout: 0,
        timeout: 0,
      });

      taskDefinitionStore.create({
        name: 't1',
        description: 'description',
        ackTimeout: 0,
        timeout: 0,
      });

      taskDefinitionStore.create({
        name: 't3',
        description: 'description',
        ackTimeout: 0,
        timeout: 0,
      });
    });

    const WORKFLOW_DEFINITION: WorkflowDefinition.IWorkflowDefinition = {
      name: 'name',
      rev: 'rev',
      description: '',
      failureStrategy: State.WorkflowFailureStrategies.Failed,
      retry: {
        limit: WORKFLOW_RETRY_LIMIT,
      },
      outputParameters: {},
      tasks: [
        {
          name: 't1',
          taskReferenceName: 't1',
          inputParameters: {},
          type: Task.TaskTypes.Task,
        },
        {
          taskReferenceName: 'd1',
          type: Task.TaskTypes.DynamicTask,
          dynamicTasks: [],
          inputParameters: {
            tasks: '${workflow.input.runTasks}',
          },
        },
        {
          name: 't3',
          taskReferenceName: 't3',
          inputParameters: {},
          type: Task.TaskTypes.Task,
        },
      ],
    };

    const SIMPLE_DYNAMIC_CHILD_TASKS = [
      {
        name: 'subt1',
        taskReferenceName: 'subt1',
        inputParameters: {},
        type: Task.TaskTypes.Task,
      },
      {
        taskReferenceName: 'subd1',
        inputParameters: {
          tasks: '${workflow.input.subTasks}',
        },
        type: Task.TaskTypes.DynamicTask,
      },
      {
        name: 'subt3',
        taskReferenceName: 'subt3',
        inputParameters: {},
        type: Task.TaskTypes.Task,
      },
    ];

    const SUB_DYNAMIC_CHILD_TASKS = [
      {
        name: 'subt21',
        taskReferenceName: 'subt21',
        inputParameters: {},
        type: Task.TaskTypes.Task,
      },
    ];

    test('All task completed', async () => {
      const TRANSACTION_ID = 'ALL_TASK_COMPLETED_SUB_TASK';
      let currentTasks: Task.ITask[];

      await transactionInstanceStore.create(
        TRANSACTION_ID,
        WORKFLOW_DEFINITION,
        {
          runTasks: SIMPLE_DYNAMIC_CHILD_TASKS,
          subTasks: SUB_DYNAMIC_CHILD_TASKS,
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

      currentTasks = mockedDispatch.mock.calls.map(R.head);
      cleanMock();

      await updateTask(currentTasks[0]);

      expect(mockedSendEvent).toBeCalledTimes(5);
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
            taskReferenceName: 'd1',
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
            taskReferenceName: 'd1',
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
            taskReferenceName: 'subt1',
            status: State.TaskStates.Scheduled,
          }),
          isError: false,
        }),
      );

      expect(mockedDispatch).toBeCalledTimes(1);
      expect(mockedDispatch).toBeCalledWith(
        expect.objectContaining({
          type: Task.TaskTypes.Task,
          taskReferenceName: 'subt1',
          status: State.TaskStates.Scheduled,
        }),
      );

      expect(transactionInstanceStore.create).toBeCalledTimes(0);
      expect(transactionInstanceStore.update).toBeCalledTimes(0);
      expect(workflowInstanceStore.create).toBeCalledTimes(0);
      expect(workflowInstanceStore.update).toBeCalledTimes(0);
      expect(taskInstanceStore.create).toBeCalledTimes(2);
      expect(taskInstanceStore.update).toBeCalledTimes(2);
      expect(taskInstanceStore.reload).toBeCalledTimes(0);

      currentTasks = mockedDispatch.mock.calls.map(R.head);
      const d1_subt1 = getEventsTaskByTaskRef('subt1');
      cleanMock();

      await updateTask(d1_subt1);

      expect(mockedSendEvent).toBeCalledTimes(5);
      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TASK',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            taskReferenceName: 'subt1',
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
            taskReferenceName: 'subt1',
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
            taskReferenceName: 'subd1',
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
            taskReferenceName: 'subd1',
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
            taskReferenceName: 'subt21',
            status: State.TaskStates.Scheduled,
          }),
          isError: false,
        }),
      );

      expect(mockedDispatch).toBeCalledTimes(1);
      expect(mockedDispatch).toBeCalledWith(
        expect.objectContaining({
          type: Task.TaskTypes.Task,
          taskReferenceName: 'subt21',
          status: State.TaskStates.Scheduled,
        }),
      );

      expect(transactionInstanceStore.create).toBeCalledTimes(0);
      expect(transactionInstanceStore.update).toBeCalledTimes(0);
      expect(workflowInstanceStore.create).toBeCalledTimes(0);
      expect(workflowInstanceStore.update).toBeCalledTimes(0);
      expect(taskInstanceStore.create).toBeCalledTimes(2);
      expect(taskInstanceStore.update).toBeCalledTimes(2);
      expect(taskInstanceStore.reload).toBeCalledTimes(0);

      currentTasks = mockedDispatch.mock.calls.map(R.head);
      const d1_subd1_subt21 = getEventsTaskByTaskRef('subt21');
      cleanMock();

      await updateTask(d1_subd1_subt21);

      expect(mockedSendEvent).toBeCalledTimes(4);
      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TASK',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            taskReferenceName: 'subt21',
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
            taskReferenceName: 'subt21',
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
            taskReferenceName: 'subd1',
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
            taskReferenceName: 'subt3',
            status: State.TaskStates.Scheduled,
          }),
          isError: false,
        }),
      );

      expect(mockedDispatch).toBeCalledTimes(1);
      expect(mockedDispatch).toBeCalledWith(
        expect.objectContaining({
          type: Task.TaskTypes.Task,
          taskReferenceName: 'subt3',
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

      currentTasks = mockedDispatch.mock.calls.map(R.head);
      const d1_subt3 = getEventsTaskByTaskRef('subt3');
      cleanMock();

      await updateTask(d1_subt3);

      expect(mockedSendEvent).toBeCalledTimes(4);

      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TASK',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            taskReferenceName: 'subt3',
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
            taskReferenceName: 'subt3',
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
            taskReferenceName: 'd1',
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

      currentTasks = mockedDispatch.mock.calls.map(R.head);
      const t3 = getEventsTaskByTaskRef('t3');
      cleanMock();

      await updateTask(t3);

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
          type: 'TRANSACTION',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            status: State.TransactionStates.Completed,
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

      expect(mockedDispatch).toBeCalledTimes(0);
      expect(transactionInstanceStore.create).toBeCalledTimes(0);
      expect(transactionInstanceStore.update).toBeCalledTimes(1);
      expect(workflowInstanceStore.create).toBeCalledTimes(0);
      expect(workflowInstanceStore.update).toBeCalledTimes(1);
      expect(taskInstanceStore.create).toBeCalledTimes(0);
      expect(taskInstanceStore.update).toBeCalledTimes(2);
      expect(taskInstanceStore.reload).toBeCalledTimes(0);

      cleanMock();
    });
  });
});

describe('No Task Specific', () => {
  afterEach(cleanMock);

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
  ])('Integrate test store (%p)', (allStores: IAllStoreType): void => {
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

      taskDefinitionStore.create({
        name: 'subt1',
        description: 'description',
        ackTimeout: 0,
        timeout: 0,
      });
    });

    const WORKFLOW_DEFINITION: WorkflowDefinition.IWorkflowDefinition = {
      name: 'name',
      rev: 'rev',
      description: '',
      failureStrategy: State.WorkflowFailureStrategies.Failed,
      retry: {
        limit: WORKFLOW_RETRY_LIMIT,
      },
      outputParameters: {},
      tasks: [
        {
          taskReferenceName: 'd1',
          type: Task.TaskTypes.DynamicTask,
          dynamicTasks: [],
          inputParameters: {
            tasks: '${workflow.input.runTasks}',
          },
        },
      ],
    };

    const SIMPLE_DYNAMIC_CHILD_TASKS = [];

    test('No Task Specific', async () => {
      const TRANSACTION_ID = 'ALL_TASK_COMPLETED_DYNAMIC_0';
      //let currentTasks: Task.ITask[];

      await transactionInstanceStore.create(
        TRANSACTION_ID,
        WORKFLOW_DEFINITION,
        {
          runTasks: SIMPLE_DYNAMIC_CHILD_TASKS,
        },
      );

      expect(mockedSendEvent).toBeCalledTimes(6);
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
            taskReferenceName: 'd1',
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
            taskReferenceName: 'd1',
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
      expect(transactionInstanceStore.create).toBeCalledTimes(1);
      expect(transactionInstanceStore.update).toBeCalledTimes(1);
      expect(workflowInstanceStore.create).toBeCalledTimes(1);
      expect(workflowInstanceStore.update).toBeCalledTimes(1);
      expect(taskInstanceStore.create).toBeCalledTimes(1);
      expect(taskInstanceStore.update).toBeCalledTimes(1);
      expect(taskInstanceStore.reload).toBeCalledTimes(0);

      cleanMock();
    });
  });
});

describe('Duplicate Task Reference', () => {
  afterEach(cleanMock);

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
  ])('Integrate test store (%p)', (allStores: IAllStoreType): void => {
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

      taskDefinitionStore.create({
        name: 'subt1',
        description: 'description',
        ackTimeout: 0,
        timeout: 0,
      });
    });

    const WORKFLOW_DEFINITION: WorkflowDefinition.IWorkflowDefinition = {
      name: 'name',
      rev: 'rev',
      description: '',
      failureStrategy: State.WorkflowFailureStrategies.Failed,
      retry: {
        limit: WORKFLOW_RETRY_LIMIT,
      },
      outputParameters: {},
      tasks: [
        {
          taskReferenceName: 'd1',
          type: Task.TaskTypes.DynamicTask,
          dynamicTasks: [],
          inputParameters: {
            tasks: '${workflow.input.runTasks}',
          },
        },
      ],
    };

    const SIMPLE_DYNAMIC_CHILD_TASKS = [
      {
        taskReferenceName: 'xxxx',
        name: 'subt1',
        type: Task.TaskTypes.Task,
        inputParameters: {},
      },
      {
        taskReferenceName: 'xxxx',
        name: 'subt1',
        type: Task.TaskTypes.Task,
        inputParameters: {},
      },
    ];

    test('Duplicate Task Reference', async () => {
      const TRANSACTION_ID = 'TASK_REFERENCE_NOT_FOUND';

      await transactionInstanceStore.create(
        TRANSACTION_ID,
        WORKFLOW_DEFINITION,
        {
          runTasks: SIMPLE_DYNAMIC_CHILD_TASKS,
        },
      );

      expect(mockedSendEvent).toBeCalledTimes(6);
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
            taskReferenceName: 'd1',
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
            taskReferenceName: 'd1',
            status: State.TaskStates.Failed,
          }),
          isError: false,
        }),
      );

      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'WORKFLOW',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            status: State.WorkflowStates.Failed,
          }),
          isError: false,
        }),
      );

      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TRANSACTION',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            status: State.TransactionStates.Failed,
          }),
          isError: false,
        }),
      );

      expect(mockedDispatch).toBeCalledTimes(0);
      expect(transactionInstanceStore.create).toBeCalledTimes(1);
      expect(transactionInstanceStore.update).toBeCalledTimes(1);
      expect(workflowInstanceStore.create).toBeCalledTimes(1);
      expect(workflowInstanceStore.update).toBeCalledTimes(1);
      expect(taskInstanceStore.create).toBeCalledTimes(1);
      expect(taskInstanceStore.update).toBeCalledTimes(1);
      expect(taskInstanceStore.reload).toBeCalledTimes(0);

      cleanMock();
    });
  });
});

describe('Task Definition not found', () => {
  afterEach(cleanMock);

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
  ])('Integrate test store (%p)', (allStores: IAllStoreType): void => {
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
      outputParameters: {},
      tasks: [
        {
          taskReferenceName: 'd1',
          type: Task.TaskTypes.DynamicTask,
          dynamicTasks: [],
          inputParameters: {
            tasks: '${workflow.input.runTasks}',
          },
        },
      ],
    };

    const SIMPLE_DYNAMIC_CHILD_TASKS = [
      {
        taskReferenceName: 'xxxx',
        name: 'xxxx',
        type: Task.TaskTypes.Task,
        inputParameters: {},
      },
    ];

    test('Task Definition not found', async () => {
      const TRANSACTION_ID = 'TASK_REFERENCE_NOT_FOUND';
      //let currentTasks: Task.ITask[];

      await transactionInstanceStore.create(
        TRANSACTION_ID,
        WORKFLOW_DEFINITION,
        {
          runTasks: SIMPLE_DYNAMIC_CHILD_TASKS,
        },
      );

      expect(mockedSendEvent).toBeCalledTimes(6);
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
            taskReferenceName: 'd1',
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
            taskReferenceName: 'd1',
            status: State.TaskStates.Failed,
          }),
          isError: false,
        }),
      );

      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'WORKFLOW',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            status: State.WorkflowStates.Failed,
          }),
          isError: false,
        }),
      );

      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TRANSACTION',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            status: State.TransactionStates.Failed,
          }),
          isError: false,
        }),
      );

      expect(mockedDispatch).toBeCalledTimes(0);
      expect(transactionInstanceStore.create).toBeCalledTimes(1);
      expect(transactionInstanceStore.update).toBeCalledTimes(1);
      expect(workflowInstanceStore.create).toBeCalledTimes(1);
      expect(workflowInstanceStore.update).toBeCalledTimes(1);
      expect(taskInstanceStore.create).toBeCalledTimes(1);
      expect(taskInstanceStore.update).toBeCalledTimes(1);
      expect(taskInstanceStore.reload).toBeCalledTimes(0);

      cleanMock();
    });
  });
});

describe('Task input is object (Not valid)', () => {
  afterEach(cleanMock);

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
  ])('Integrate test store (%p)', (allStores: IAllStoreType): void => {
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

      taskDefinitionStore.create({
        name: 'subt1',
        description: 'description',
        ackTimeout: 0,
        timeout: 0,
      });
    });

    const WORKFLOW_DEFINITION: WorkflowDefinition.IWorkflowDefinition = {
      name: 'name',
      rev: 'rev',
      description: '',
      failureStrategy: State.WorkflowFailureStrategies.Failed,
      retry: {
        limit: WORKFLOW_RETRY_LIMIT,
      },
      outputParameters: {},
      tasks: [
        {
          taskReferenceName: 'd1',
          type: Task.TaskTypes.DynamicTask,
          dynamicTasks: [],
          inputParameters: {
            tasks: '${workflow.input.runTasks}',
          },
        },
      ],
    };

    const SIMPLE_DYNAMIC_CHILD_TASKS = { hello: 'World' };

    test('Task input is object (Not valid)', async () => {
      const TRANSACTION_ID = 'ALL_TASK_COMPLETED_DYNAMIC_0';

      await transactionInstanceStore.create(
        TRANSACTION_ID,
        WORKFLOW_DEFINITION,
        {
          runTasks: SIMPLE_DYNAMIC_CHILD_TASKS,
        },
      );

      expect(mockedSendEvent).toBeCalledTimes(6);
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
            taskReferenceName: 'd1',
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
            taskReferenceName: 'd1',
            status: State.TaskStates.Failed,
          }),
          isError: false,
        }),
      );

      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'WORKFLOW',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            status: State.WorkflowStates.Failed,
          }),
          isError: false,
        }),
      );

      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TRANSACTION',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            status: State.TransactionStates.Failed,
          }),
          isError: false,
        }),
      );

      expect(mockedDispatch).toBeCalledTimes(0);
      expect(transactionInstanceStore.create).toBeCalledTimes(1);
      expect(transactionInstanceStore.update).toBeCalledTimes(1);
      expect(workflowInstanceStore.create).toBeCalledTimes(1);
      expect(workflowInstanceStore.update).toBeCalledTimes(1);
      expect(taskInstanceStore.create).toBeCalledTimes(1);
      expect(taskInstanceStore.update).toBeCalledTimes(1);
      expect(taskInstanceStore.reload).toBeCalledTimes(0);

      cleanMock();
    });
  });
});

describe('Workflow Definition specific string on task input', () => {
  afterEach(cleanMock);

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
  ])('Integrate test store (%p)', (allStores: IAllStoreType): void => {
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

      taskDefinitionStore.create({
        name: 'subt1',
        description: 'description',
        ackTimeout: 0,
        timeout: 0,
      });
    });

    const WORKFLOW_DEFINITION: WorkflowDefinition.IWorkflowDefinition = {
      name: 'name',
      rev: 'rev',
      description: '',
      failureStrategy: State.WorkflowFailureStrategies.Failed,
      retry: {
        limit: WORKFLOW_RETRY_LIMIT,
      },
      outputParameters: {},
      tasks: [
        {
          taskReferenceName: 'd1',
          type: Task.TaskTypes.DynamicTask,
          dynamicTasks: [],
          inputParameters: {
            tasks: 'Hello World',
          },
        },
      ],
    };

    const SIMPLE_DYNAMIC_CHILD_TASKS = { hello: 'World' };

    test('Workflow Definition specific string on task input', async () => {
      const TRANSACTION_ID = 'ALL_TASK_COMPLETED_DYNAMIC_0';

      await transactionInstanceStore.create(
        TRANSACTION_ID,
        WORKFLOW_DEFINITION,
        {
          runTasks: SIMPLE_DYNAMIC_CHILD_TASKS,
        },
      );

      expect(mockedSendEvent).toBeCalledTimes(6);
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
            taskReferenceName: 'd1',
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
            taskReferenceName: 'd1',
            status: State.TaskStates.Failed,
          }),
          isError: false,
        }),
      );

      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'WORKFLOW',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            status: State.WorkflowStates.Failed,
          }),
          isError: false,
        }),
      );

      expect(mockedSendEvent).toBeCalledWith(
        expect.objectContaining({
          type: 'TRANSACTION',
          details: expect.objectContaining({
            transactionId: TRANSACTION_ID,
            status: State.TransactionStates.Failed,
          }),
          isError: false,
        }),
      );

      expect(mockedDispatch).toBeCalledTimes(0);
      expect(transactionInstanceStore.create).toBeCalledTimes(1);
      expect(transactionInstanceStore.update).toBeCalledTimes(1);
      expect(workflowInstanceStore.create).toBeCalledTimes(1);
      expect(workflowInstanceStore.update).toBeCalledTimes(1);
      expect(taskInstanceStore.create).toBeCalledTimes(1);
      expect(taskInstanceStore.update).toBeCalledTimes(1);
      expect(taskInstanceStore.reload).toBeCalledTimes(0);

      cleanMock();
    });
  });
});
