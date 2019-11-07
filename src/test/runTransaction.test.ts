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
import { processSystemTasks } from '../systemTask';

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
];

const mockedDispatch = <jest.Mock<typeof kafka.dispatch>>kafka.dispatch;
const mockedSendTimer = <jest.Mock<typeof kafka.sendTimer>>kafka.sendTimer;

const cleanMock = () => {
  storeSpies.map((spy: jest.SpyInstance<any>) => spy.mockClear());
  mockedDispatch.mockClear();
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

describe('Run transaction test', () => {
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
  ])(
    'Integate test store (%p)',
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

      describe.each([
        {
          workflowFailureStrategy: State.WorkflowFailureStrategies.Failed,
          taskStatus: State.TaskStates.Completed,
          taskCompensateStatus: State.TaskStates.Completed,
          transactionExpectResult: State.TransactionStates.Completed,
        },
        {
          workflowFailureStrategy: State.WorkflowFailureStrategies.Failed,
          taskStatus: State.TaskStates.Failed,
          taskCompensateStatus: State.TaskStates.Completed,
          transactionExpectResult: State.TransactionStates.Failed,
        },
      ])(
        'Integate test workflows for (%p)',
        ({
          workflowFailureStrategy,
          taskStatus: workflowResult,
          taskCompensateStatus: workflowCompensateResult,
          transactionExpectResult,
        }: {
          workflowFailureStrategy: State.WorkflowFailureStrategies;
          taskStatus: State.TaskStates;
          taskCompensateStatus: State.TaskStates;
          transactionExpectResult: State.TransactionStates;
        }) => {
          // tslint:disable-next-line: max-func-body-length
          describe('Simple workflow', () => {
            const TRANSACTION_ID = 'simpleTransactionId';
            let currentTask: Task.ITask;

            test('Start transaction and dispatch task', async () => {
              const SAMPLE_WORKFLOW: WorkflowDefinition.IWorkflowDefinition = {
                name: 'name',
                rev: 'rev',
                description: '',
                failureStrategy: workflowFailureStrategy,
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
                    retry: {
                      delay: 0,
                      limit: TASK_RETRY_LIMIT,
                    },
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

              expect(mockedDispatch).toBeCalledTimes(1);
              expect(mockedDispatch).toBeCalledWith(
                expect.objectContaining({
                  type: Task.TaskTypes.Task,
                  taskReferenceName: 't1',
                  status: State.TaskStates.Scheduled,
                }),
                TRANSACTION_ID,
                false,
              );
              expect(transactionInstanceStore.create).toBeCalledTimes(1);
              expect(transactionInstanceStore.update).toBeCalledTimes(0);
              expect(workflowInstanceStore.create).toBeCalledTimes(1);
              expect(workflowInstanceStore.update).toBeCalledTimes(0);
              expect(taskInstanceStore.create).toBeCalledTimes(1);
              expect(taskInstanceStore.update).toBeCalledTimes(0);

              currentTask = mockedDispatch.mock.calls[0][0];
            });

            test('Process t1 task', async () => {
              await state.processUpdateTasks([
                {
                  taskId: currentTask.taskId,
                  isSystem: false,
                  transactionId: currentTask.transactionId,
                  status: State.TaskStates.Completed,
                },
              ]);

              // Should not accept this event and task won't updated
              expect(mockedDispatch).toBeCalledTimes(0);

              await updateTask(currentTask);

              expect(mockedDispatch).toBeCalledWith(
                expect.objectContaining({
                  type: Task.TaskTypes.Task,
                  taskReferenceName: 't2',
                  status: State.TaskStates.Scheduled,
                }),
                TRANSACTION_ID,
                false,
              );
              expect(mockedDispatch).toBeCalledTimes(1);
              expect(transactionInstanceStore.create).toBeCalledTimes(0);
              expect(transactionInstanceStore.update).toBeCalledTimes(0);
              expect(workflowInstanceStore.create).toBeCalledTimes(0);
              expect(workflowInstanceStore.update).toBeCalledTimes(0);
              expect(taskInstanceStore.create).toBeCalledTimes(1);
              expect(taskInstanceStore.update).toBeCalledTimes(3);

              currentTask = mockedDispatch.mock.calls[0][0];
            });

            test('Process t2 task', async () => {
              await updateTask(currentTask);

              expect(mockedDispatch).toBeCalledWith(
                expect.objectContaining({
                  type: Task.TaskTypes.Task,
                  taskReferenceName: 't3',
                  status: State.TaskStates.Scheduled,
                }),
                TRANSACTION_ID,
                false,
              );
              expect(mockedDispatch).toBeCalledTimes(1);
              expect(transactionInstanceStore.create).toBeCalledTimes(0);
              expect(transactionInstanceStore.update).toBeCalledTimes(0);
              expect(workflowInstanceStore.create).toBeCalledTimes(0);
              expect(workflowInstanceStore.update).toBeCalledTimes(0);
              expect(taskInstanceStore.create).toBeCalledTimes(1);
              expect(taskInstanceStore.update).toBeCalledTimes(2);

              currentTask = mockedDispatch.mock.calls[0][0];
            });

            test('Transaction, workflow must still in running state', async () => {
              const transaction = await transactionInstanceStore.get(
                TRANSACTION_ID,
              );
              expect(transaction.status).toEqual(
                State.TransactionStates.Running,
              );
            });

            // tslint:disable-next-line: max-func-body-length
            test('Process t3 task', async () => {
              await updateTask(currentTask, workflowResult);

              if (workflowResult === State.TaskStates.Completed) {
                expect(transactionInstanceStore.update).toBeCalledWith(
                  expect.objectContaining({
                    status: transactionExpectResult,
                  }),
                );

                expect(mockedDispatch).toBeCalledTimes(0);
                expect(transactionInstanceStore.create).toBeCalledTimes(0);
                expect(transactionInstanceStore.update).toBeCalledTimes(1);
                expect(workflowInstanceStore.create).toBeCalledTimes(0);
                expect(workflowInstanceStore.update).toBeCalledTimes(1);
                expect(taskInstanceStore.create).toBeCalledTimes(0);
                expect(taskInstanceStore.update).toBeCalledTimes(2);
              } else if (
                [
                  State.TaskStates.Failed,
                  State.TaskStates.AckTimeOut,
                  State.TaskStates.Timeout,
                ].includes(workflowResult)
              ) {
                if (
                  workflowFailureStrategy ===
                  State.WorkflowFailureStrategies.Failed
                ) {
                  if (
                    transactionExpectResult ===
                    State.TransactionStates.Completed
                  ) {
                    cleanMock();
                    await updateTask(currentTask, State.TaskStates.Completed);
                  } else {
                    for (
                      let retries = TASK_RETRY_LIMIT;
                      retries >= 0;
                      retries--
                    ) {
                      cleanMock();
                      await updateTask(
                        { ...currentTask, retries: retries - 1 },
                        workflowResult,
                      );
                      console.log(retries, workflowResult);
                      if (retries !== 0) {
                        // console.log(retries, workflowResult);
                        // expect(mockedSendTimer).toBeCalledWith({
                        //   type: Timer.TimerType.delayTask,
                        //   task: expect.objectContaining({
                        //     taskId: currentTask.taskId,
                        //     retries: retries,
                        //   }),
                        // });
                        expect(mockedSendTimer).toBeCalledTimes(1);
                      } else {
                        expect(mockedSendTimer).toBeCalledTimes(0);
                      }
                    }
                  }

                  expect(transactionInstanceStore.update).toBeCalledWith(
                    expect.objectContaining({
                      status: transactionExpectResult,
                    }),
                  );

                  expect(mockedDispatch).toBeCalledTimes(0);
                  expect(transactionInstanceStore.create).toBeCalledTimes(0);
                  expect(transactionInstanceStore.update).toBeCalledTimes(1);
                  expect(workflowInstanceStore.create).toBeCalledTimes(0);
                  expect(workflowInstanceStore.update).toBeCalledTimes(1);
                  expect(taskInstanceStore.create).toBeCalledTimes(0);
                  expect(taskInstanceStore.update).toBeCalledTimes(2);
                } else if (
                  workflowFailureStrategy ===
                  State.WorkflowFailureStrategies.Compensate
                ) {
                  expect(mockedDispatch).toBeCalledWith(
                    expect.objectContaining({
                      Type: Task.TaskTypes.Compensate,
                      taskReferenceName: 't2',
                      status: State.TaskStates.Scheduled,
                    }),
                    TRANSACTION_ID,
                    false,
                  );
                  expect(mockedDispatch).toBeCalledTimes(1);

                  await updateTask(mockedDispatch.mock.calls[0][0]);

                  expect(mockedDispatch).toBeCalledWith(
                    expect.objectContaining({
                      Type: Task.TaskTypes.Compensate,
                      taskReferenceName: 't1',
                      status: State.TaskStates.Scheduled,
                    }),
                    TRANSACTION_ID,
                    false,
                  );
                  expect(mockedDispatch).toBeCalledTimes(2);

                  await updateTask(
                    mockedDispatch.mock.calls[1][0],
                    workflowCompensateResult,
                  );

                  expect(transactionInstanceStore.update).toBeCalledWith(
                    expect.objectContaining({
                      status: transactionExpectResult,
                    }),
                  );

                  expect(mockedDispatch).toBeCalledTimes(0);
                  expect(transactionInstanceStore.create).toBeCalledTimes(0);
                  expect(transactionInstanceStore.update).toBeCalledTimes(1);
                  expect(workflowInstanceStore.create).toBeCalledTimes(0);
                  expect(workflowInstanceStore.update).toBeCalledTimes(1);
                  expect(taskInstanceStore.create).toBeCalledTimes(0);
                  expect(taskInstanceStore.update).toBeCalledTimes(2);
                }
              }
            });

            test('Instance data must be clean up', async () => {
              const transaction = await transactionInstanceStore.get(
                TRANSACTION_ID,
              );
              expect(transaction).toEqual(null);
            });
          });

          describe('Decision and Parallel workflow', () => {
            const TRANSACTION_ID = 'decisionParallelTransactionId';
            const dispatchedTasks: { [taskName: string]: Task.ITask } = {};
            // tslint:disable-next-line: max-func-body-length
            test('Start transaction and dispatch task', async () => {
              const SAMPLE_WORKFLOW: WorkflowDefinition.IWorkflowDefinition = {
                name: 'name',
                rev: 'rev',
                description: '',
                failureStrategy: State.WorkflowFailureStrategies.Failed,
                retry: {
                  limit: 3,
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
                        },
                        {
                          name: 'p2_1_t2',
                          taskReferenceName: 'p2_1_t2',
                          inputParameters: { a: '${workflow.input.a}' },
                          type: Task.TaskTypes.Task,
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
                            },
                          ],
                          decisions: {
                            case1: [
                              {
                                name: 'p2_2_d1_case1_t1',
                                taskReferenceName: 'p2_2_d1_case1_t1',
                                inputParameters: { c: '${workflow.input.c}' },
                                type: Task.TaskTypes.Task,
                              },
                            ],
                            case2: [
                              {
                                name: 'p2_2_d1_case2_t1',
                                taskReferenceName: 'p2_2_d1_case2_t1',
                                inputParameters: { c: '${workflow.input.c}' },
                                type: Task.TaskTypes.Task,
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

              await transactionInstanceStore.create(
                TRANSACTION_ID,
                SAMPLE_WORKFLOW,
                {
                  a: 'hello',
                  case: 'case1',
                },
              );
              dispatchedTasks[mockedDispatch.mock.calls[0][0].taskName] =
                mockedDispatch.mock.calls[0][0];
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

            test('Process 1st task', async () => {
              // next task only dispatched if this task completed
              const currentTask = dispatchedTasks['t1'];

              await state.processUpdateTasks([
                {
                  taskId: currentTask.taskId,
                  isSystem: false,
                  transactionId: currentTask.transactionId,
                  status: State.TaskStates.Completed,
                },
              ]);

              // Should not accept this event and task won't updated
              expect(mockedDispatch).toBeCalledTimes(0);
              expect(
                await taskInstanceStore.get(currentTask.taskId),
              ).toMatchObject({
                taskId: currentTask.taskId,
                status: State.TaskStates.Scheduled,
              });

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
                  status: State.TaskStates.Completed,
                },
              ]);

              dispatchedTasks[mockedDispatch.mock.calls[0][0].taskName] =
                mockedDispatch.mock.calls[0][0];

              expect(mockedDispatch).toBeCalledTimes(1);
              expect(mockedDispatch.mock.calls[0][0]).toMatchObject({
                taskReferenceName: 'p2',
                status: State.TaskStates.Scheduled,
              });
              expect(transactionInstanceStore.create).toBeCalledTimes(0);
              expect(transactionInstanceStore.update).toBeCalledTimes(0);
              expect(workflowInstanceStore.create).toBeCalledTimes(0);
              expect(workflowInstanceStore.update).toBeCalledTimes(0);
              expect(taskInstanceStore.create).toBeCalledTimes(1);
              expect(taskInstanceStore.update).toBeCalledTimes(3);
            });

            test('Process parallel system task', async () => {
              await processSystemTasks([dispatchedTasks['p2']]);

              // Will dispatch 2 child of parallel
              dispatchedTasks[mockedDispatch.mock.calls[0][0].taskName] =
                mockedDispatch.mock.calls[0][0];
              dispatchedTasks[mockedDispatch.mock.calls[1][0].taskName] =
                mockedDispatch.mock.calls[1][0];

              expect(mockedDispatch).toBeCalledTimes(2);
              expect(mockedDispatch).toBeCalledWith(
                expect.objectContaining({
                  taskName: 'p2_1_t1',
                  taskReferenceName: 'p2_1_t1',
                  type: Task.TaskTypes.Task,
                }),
                'decisionParallelTransactionId',
                false,
              );
              expect(mockedDispatch).toBeCalledWith(
                expect.objectContaining({
                  taskName: 'p2_2_d1',
                  taskReferenceName: 'p2_2_d1',
                  type: Task.TaskTypes.Decision,
                }),
                'decisionParallelTransactionId',
                true,
              );
              expect(transactionInstanceStore.create).toBeCalledTimes(0);
              expect(transactionInstanceStore.update).toBeCalledTimes(0);
              expect(workflowInstanceStore.create).toBeCalledTimes(0);
              expect(workflowInstanceStore.update).toBeCalledTimes(0);
              expect(taskInstanceStore.create).toBeCalledTimes(2);
              expect(taskInstanceStore.update).toBeCalledTimes(1);
            });

            test('Process decision system task', async () => {
              await processSystemTasks([dispatchedTasks['p2_2_d1']]);

              // Will dispatch 2 child of parallel
              dispatchedTasks[mockedDispatch.mock.calls[0][0].taskName] =
                mockedDispatch.mock.calls[0][0];

              expect(mockedDispatch).toBeCalledTimes(1);
              expect(mockedDispatch).toBeCalledWith(
                expect.objectContaining({
                  taskName: 'p2_2_d1_case1_t1',
                  taskReferenceName: 'p2_2_d1_case1_t1',
                  type: Task.TaskTypes.Task,
                }),
                'decisionParallelTransactionId',
                false,
              );
              expect(transactionInstanceStore.create).toBeCalledTimes(0);
              expect(transactionInstanceStore.update).toBeCalledTimes(0);
              expect(workflowInstanceStore.create).toBeCalledTimes(0);
              expect(workflowInstanceStore.update).toBeCalledTimes(0);
              expect(taskInstanceStore.create).toBeCalledTimes(1);
              expect(taskInstanceStore.update).toBeCalledTimes(1);
            });

            test('Process p2_1_t1 task', async () => {
              // next task only dispatched if this task completed
              const currentTask = dispatchedTasks['p2_1_t1'];
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
                  status: State.TaskStates.Completed,
                },
              ]);

              dispatchedTasks[mockedDispatch.mock.calls[0][0].taskName] =
                mockedDispatch.mock.calls[0][0];

              expect(mockedDispatch).toBeCalledTimes(1);
              expect(mockedDispatch.mock.calls[0][0]).toMatchObject({
                taskReferenceName: 'p2_1_t2',
                status: State.TaskStates.Scheduled,
              });
              expect(transactionInstanceStore.create).toBeCalledTimes(0);
              expect(transactionInstanceStore.update).toBeCalledTimes(0);
              expect(workflowInstanceStore.create).toBeCalledTimes(0);
              expect(workflowInstanceStore.update).toBeCalledTimes(0);
              expect(taskInstanceStore.create).toBeCalledTimes(1);
              expect(taskInstanceStore.update).toBeCalledTimes(2);
            });

            test('Process p2_1_t2 task', async () => {
              // next task only dispatched if this task completed
              const currentTask = dispatchedTasks['p2_1_t2'];
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
                  status: State.TaskStates.Completed,
                },
              ]);

              expect(mockedDispatch).toBeCalledTimes(0);
              expect(transactionInstanceStore.create).toBeCalledTimes(0);
              expect(transactionInstanceStore.update).toBeCalledTimes(0);
              expect(workflowInstanceStore.create).toBeCalledTimes(0);
              expect(workflowInstanceStore.update).toBeCalledTimes(0);
              expect(taskInstanceStore.create).toBeCalledTimes(0);
              expect(taskInstanceStore.update).toBeCalledTimes(2);
            });

            //   test('Transaction, workflow must still in running state', async () => {
            //     const transaction = await transactionInstanceStore.get(
            //       TRANSACTION_ID,
            //     );
            //     expect(transaction.status).toEqual(State.TransactionStates.Running);
            //   });

            test('Process p2_2_d1_case1_t1 task', async () => {
              // This is last task of workflow, no more task to dispatch
              const currentTask = dispatchedTasks['p2_2_d1_case1_t1'];
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
                  status: State.TaskStates.Completed,
                },
              ]);

              dispatchedTasks[mockedDispatch.mock.calls[0][0].taskName] =
                mockedDispatch.mock.calls[0][0];

              expect(mockedDispatch).toBeCalledTimes(1);
              expect(mockedDispatch).toBeCalledWith(
                expect.objectContaining({
                  taskName: 't3',
                  taskReferenceName: 't3',
                  type: Task.TaskTypes.Task,
                }),
                'decisionParallelTransactionId',
                false,
              );

              expect(transactionInstanceStore.create).toBeCalledTimes(0);
              expect(transactionInstanceStore.update).toBeCalledTimes(0);
              expect(workflowInstanceStore.create).toBeCalledTimes(0);
              expect(workflowInstanceStore.update).toBeCalledTimes(0);
              expect(taskInstanceStore.create).toBeCalledTimes(1);
              expect(taskInstanceStore.update).toBeCalledTimes(4);
            });

            test('Process t3 task', async () => {
              // This is last task of workflow, no more task to dispatch
              const currentTask = dispatchedTasks['t3'];
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
            //   test('Instance data must be clean up', async () => {
            //     const transaction = await transactionInstanceStore.get(
            //       TRANSACTION_ID,
            //     );
            //     expect(transaction).toEqual(null);

            //     for (const dispatchedTask of dispatchedTasks) {
            //       const task = await taskInstanceStore.get(dispatchedTask.taskId);
            //       expect(task).toEqual(null);
            //     }
            //   });
          });
        },
      );
    },
  );
});
