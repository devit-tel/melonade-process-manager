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
import { TaskInstanceMongooseStore } from '../store/mongoose/taskInstance';
import { TransactionInstanceMongooseStore } from '../store/mongoose/transactionInstance';
import { WorkflowInstanceMongooseStore } from '../store/mongoose/workflowInstance';
import { TaskInstanceRedisStore } from '../store/redis/taskInstance';
import { TransactionInstanceRedisStore } from '../store/redis/transactionInstance';
import { WorkflowInstanceRedisStore } from '../store/redis/workflowInstance';

let mongodbUrl: string = `mongodb://127.0.0.1:51553/melonade-test`;

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
// const mockedSendEvent = <jest.Mock<typeof kafka.sendEvent>>kafka.sendEvent;

describe('State test', () => {
  afterEach(() => {
    storeSpies.map((spy: jest.SpyInstance<any>) => spy.mockClear());
    mockedDispatch.mockClear();
  });

  const TRANSACTION_ID = 'someTransactionId';

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
    {
      taskDefinitionStoreClient: new TaskDefinitionMemoryStore(),
      workflowDefinitionStoreClient: new WorkflowDefinitionMemoryStore(),
      taskInstanceStoreClient: new TaskInstanceMongooseStore(mongodbUrl, {}),
      workflowInstanceStoreClient: new WorkflowInstanceMongooseStore(
        mongodbUrl,
        {},
      ),
      transactionInstanceStoreClient: new TransactionInstanceMongooseStore(
        mongodbUrl,
        {},
      ),
    },
  ])(
    'Integate test workflows for (%p)',
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

      describe('Simple workflow', () => {
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
            TRANSACTION_ID,
            SAMPLE_WORKFLOW,
            {
              a: 'hello',
            },
          );
          dispatchedTasks.push(mockedDispatch.mock.calls[0][0]);
          expect(mockedDispatch).toBeCalledTimes(1);
          expect(mockedDispatch.mock.calls[0][0]).toMatchObject({
            taskReferenceName: 't1',
            status: State.TaskStates.Scheduled,
          });
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
              status: State.TaskStates.Completed,
            },
          ]);

          // Should not accept this event and task won't updated
          expect(mockedDispatch).toBeCalledTimes(0);
          expect(await taskInstanceStore.get(currentTask.taskId)).toMatchObject(
            {
              taskId: currentTask.taskId,
              status: State.TaskStates.Scheduled,
            },
          );

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
          expect(mockedDispatch.mock.calls[0][0]).toMatchObject({
            taskReferenceName: 't2',
            status: State.TaskStates.Scheduled,
          });
          expect(transactionInstanceStore.create).toBeCalledTimes(0);
          expect(transactionInstanceStore.update).toBeCalledTimes(0);
          expect(workflowInstanceStore.create).toBeCalledTimes(0);
          expect(workflowInstanceStore.update).toBeCalledTimes(0);
          expect(taskInstanceStore.create).toBeCalledTimes(1);
          expect(taskInstanceStore.update).toBeCalledTimes(3);
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
          expect(mockedDispatch.mock.calls[0][0]).toMatchObject({
            taskReferenceName: 't3',
            status: State.TaskStates.Scheduled,
          });
          expect(transactionInstanceStore.create).toBeCalledTimes(0);
          expect(transactionInstanceStore.update).toBeCalledTimes(0);
          expect(workflowInstanceStore.create).toBeCalledTimes(0);
          expect(workflowInstanceStore.update).toBeCalledTimes(0);
          expect(taskInstanceStore.create).toBeCalledTimes(1);
          expect(taskInstanceStore.update).toBeCalledTimes(2);
        });

        test('Transaction, workflow must still in running state', async () => {
          const transaction = await transactionInstanceStore.get(
            TRANSACTION_ID,
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
            TRANSACTION_ID,
          );
          expect(transaction).toEqual(null);

          for (const dispatchedTask of dispatchedTasks) {
            const task = await taskInstanceStore.get(dispatchedTask.taskId);
            expect(task).toEqual(null);
          }
        });
      });

      describe('Decision and Parrallel workflow', () => {
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
            TRANSACTION_ID,
            SAMPLE_WORKFLOW,
            {
              a: 'hello',
            },
          );
          dispatchedTasks.push(mockedDispatch.mock.calls[0][0]);
          expect(mockedDispatch).toBeCalledTimes(1);
          expect(mockedDispatch.mock.calls[0][0]).toMatchObject({
            taskReferenceName: 't1',
            status: State.TaskStates.Scheduled,
          });
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
              status: State.TaskStates.Completed,
            },
          ]);

          // Should not accept this event and task won't updated
          expect(mockedDispatch).toBeCalledTimes(0);
          expect(await taskInstanceStore.get(currentTask.taskId)).toMatchObject(
            {
              taskId: currentTask.taskId,
              status: State.TaskStates.Scheduled,
            },
          );

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
          expect(mockedDispatch.mock.calls[0][0]).toMatchObject({
            taskReferenceName: 't2',
            status: State.TaskStates.Scheduled,
          });
          expect(transactionInstanceStore.create).toBeCalledTimes(0);
          expect(transactionInstanceStore.update).toBeCalledTimes(0);
          expect(workflowInstanceStore.create).toBeCalledTimes(0);
          expect(workflowInstanceStore.update).toBeCalledTimes(0);
          expect(taskInstanceStore.create).toBeCalledTimes(1);
          expect(taskInstanceStore.update).toBeCalledTimes(3);
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
          expect(mockedDispatch.mock.calls[0][0]).toMatchObject({
            taskReferenceName: 't3',
            status: State.TaskStates.Scheduled,
          });
          expect(transactionInstanceStore.create).toBeCalledTimes(0);
          expect(transactionInstanceStore.update).toBeCalledTimes(0);
          expect(workflowInstanceStore.create).toBeCalledTimes(0);
          expect(workflowInstanceStore.update).toBeCalledTimes(0);
          expect(taskInstanceStore.create).toBeCalledTimes(1);
          expect(taskInstanceStore.update).toBeCalledTimes(2);
        });

        test('Transaction, workflow must still in running state', async () => {
          const transaction = await transactionInstanceStore.get(
            TRANSACTION_ID,
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
            TRANSACTION_ID,
          );
          expect(transaction).toEqual(null);

          for (const dispatchedTask of dispatchedTasks) {
            const task = await taskInstanceStore.get(dispatchedTask.taskId);
            expect(task).toEqual(null);
          }
        });
      });
    },
  );
});
