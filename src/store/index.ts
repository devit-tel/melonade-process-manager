import {
  Event,
  State,
  Store,
  Task,
  TaskDefinition,
  Timer,
  Transaction,
  Workflow,
  WorkflowDefinition,
} from '@melonade/melonade-declaration';
import debug from 'debug';
import * as R from 'ramda';
import { dispatch, sendEvent, sendTimer, sendUpdate } from '../kafka';
import { toObjectByKey } from '../utils/common';
import { getCompltedAt, mapParametersToValue } from '../utils/task';

const dg = debug('melonade:store');

export interface IStore {
  isHealthy(): boolean;
}

export interface IWorkflowDefinitionStore extends IStore {
  get(
    name: string,
    rev: string,
  ): Promise<WorkflowDefinition.IWorkflowDefinition>;
  create(
    workflowDefinition: WorkflowDefinition.IWorkflowDefinition,
  ): Promise<WorkflowDefinition.IWorkflowDefinition>;
  update(
    workflowDefinition: WorkflowDefinition.IWorkflowDefinition,
  ): Promise<WorkflowDefinition.IWorkflowDefinition>;
  list(): Promise<WorkflowDefinition.IWorkflowDefinition[]>;
  delete(name: string, rev: string): Promise<void>;
  isHealthy(): boolean;
}

export interface ITaskDefinitionStore extends IStore {
  get(name: string): Promise<TaskDefinition.ITaskDefinition>;
  create(
    taskDefinition: TaskDefinition.ITaskDefinition,
  ): Promise<TaskDefinition.ITaskDefinition>;
  update(
    taskDefinition: TaskDefinition.ITaskDefinition,
  ): Promise<TaskDefinition.ITaskDefinition>;
  list(): Promise<TaskDefinition.ITaskDefinition[]>;
  isHealthy(): boolean;
}

export interface ITransactionInstanceStore extends IStore {
  get(transactionId: string): Promise<Transaction.ITransaction>;
  create(
    transactionData: Transaction.ITransaction,
  ): Promise<Transaction.ITransaction>;
  update(
    transactionUpdate: Event.ITransactionUpdate,
  ): Promise<Transaction.ITransaction>;
  delete(transactionId: string): Promise<void>;
  list(from?: number, size?: number): Promise<Store.ITransactionPaginate>;
  isHealthy(): boolean;
  changeParent(
    transactionId: string,
    parent: Transaction.ITransaction['parent'],
  ): Promise<void>;
}

export interface IWorkflowInstanceStore extends IStore {
  get(workflowId: string): Promise<Workflow.IWorkflow>;
  getByTransactionId(transactionId: string): Promise<Workflow.IWorkflow>;
  create(workflowData: Workflow.IWorkflow): Promise<Workflow.IWorkflow>;
  updateWorkflowDefinition(
    workflowDefinitionUpdate: Event.IWorkflowDefinitionUpdate,
  ): Promise<Workflow.IWorkflow>;
  update(workflowUpdate: Event.IWorkflowUpdate): Promise<Workflow.IWorkflow>;
  delete(workflowId: string, keepSubTransaction?: boolean): Promise<void>;
  deleteAll(transactionId: string, keepSubTransaction?: boolean): Promise<void>;
  isHealthy(): boolean;
}

export interface ITaskInstanceStore extends IStore {
  get(taskId: string): Promise<Task.ITask>;
  getAll(workflowId: string): Promise<Task.ITask[]>;
  create(taskData: Task.ITask): Promise<Task.ITask>;
  update(taskUpdate: Event.ITaskUpdate): Promise<Task.ITask>;
  delete(taskId: string, keepSubTransaction?: boolean): Promise<void>;
  deleteAll(workflowId: string, keepSubTransaction?: boolean): Promise<void>;
  isHealthy(): boolean;
}

export class WorkflowDefinitionStore {
  client: IWorkflowDefinitionStore;

  setClient(client: IWorkflowDefinitionStore) {
    // if (this.client) throw new Error('Already set client');
    this.client = client;
  }

  get(
    name: string,
    rev: string,
  ): Promise<WorkflowDefinition.IWorkflowDefinition> {
    return this.client.get(name, rev);
  }

  list(): Promise<WorkflowDefinition.IWorkflowDefinition[]> {
    return this.client.list();
  }

  create(
    workflowDefinition: WorkflowDefinition.IWorkflowDefinition,
  ): Promise<WorkflowDefinition.IWorkflowDefinition> {
    return this.client.create(workflowDefinition);
  }

  update(
    workflowDefinition: WorkflowDefinition.IWorkflowDefinition,
  ): Promise<WorkflowDefinition.IWorkflowDefinition> {
    return this.client.update(workflowDefinition);
  }

  delete(name: string, rev: string): Promise<void> {
    return this.client.delete(name, rev);
  }

  isHealthy(): boolean {
    return this.client.isHealthy();
  }
}

export class TaskDefinitionStore {
  client: ITaskDefinitionStore;

  setClient(client: ITaskDefinitionStore) {
    // if (this.client) throw new Error('Already set client');
    this.client = client;
  }

  get(name: string): Promise<TaskDefinition.ITaskDefinition> {
    return this.client.get(name);
  }

  list(): Promise<TaskDefinition.ITaskDefinition[]> {
    return this.client.list();
  }

  create(
    taskDefinition: TaskDefinition.ITaskDefinition,
  ): Promise<TaskDefinition.ITaskDefinition> {
    return this.client.create(taskDefinition);
  }

  update(
    taskDefinition: TaskDefinition.ITaskDefinition,
  ): Promise<TaskDefinition.ITaskDefinition> {
    return this.client.update(taskDefinition);
  }

  isHealthy(): boolean {
    return this.client.isHealthy();
  }
}

export class TransactionInstanceStore {
  client: ITransactionInstanceStore;

  setClient(client: ITransactionInstanceStore) {
    // if (this.client) throw new Error('Already set client');
    this.client = client;
  }

  get(transactionId: string): Promise<Transaction.ITransaction> {
    return this.client.get(transactionId);
  }

  create = async (
    transactionId: string,
    workflowDefinition: WorkflowDefinition.IWorkflowDefinition,
    input: any,
    tags: string[] = [],
    parent?: Transaction.ITransaction['parent'],
  ): Promise<Transaction.ITransaction> => {
    const timestamp = Date.now();
    const transaction = await this.client.create({
      transactionId,
      status: State.TransactionStates.Running,
      input,
      output: null,
      createTime: timestamp,
      endTime: null,
      workflowDefinition,
      tags,
      parent,
    });

    sendEvent({
      transactionId,
      type: 'TRANSACTION',
      isError: false,
      timestamp,
      details: transaction,
    });

    await workflowInstanceStore.create(
      transactionId,
      Workflow.WorkflowTypes.Workflow,
      workflowDefinition,
      input,
      {
        transactionDepth: parent?.depth || 0,
      },
    );

    dg(`Create ${transactionId}`);
    return transaction;
  };

  update = async (transactionUpdate: Event.ITransactionUpdate) => {
    try {
      const timestamp = Date.now();
      const transaction = await this.client.update(transactionUpdate);
      sendEvent({
        transactionId: transactionUpdate.transactionId,
        type: 'TRANSACTION',
        isError: false,
        timestamp,
        details: transaction,
      });

      const parentTransactionId = transaction.parent?.transactionId;
      const parentTaskId = transaction.parent?.taskId;
      const parentIsCompensate = transaction.parent?.isCompensate;

      if (parentTransactionId && parentTaskId) {
        if (!parentIsCompensate) {
          switch (transaction.status) {
            case State.TransactionStates.Cancelled:
            case State.TransactionStates.Compensated:
            case State.TransactionStates.Failed:
              sendUpdate({
                transactionId: parentTransactionId,
                taskId: parentTaskId,
                status: State.TaskStates.Failed,
                output: transaction.output,
              });
              break;
            case State.TransactionStates.Completed:
              sendUpdate({
                transactionId: parentTransactionId,
                taskId: parentTaskId,
                status: State.TaskStates.Completed,
                output: transaction.output,
              });
              break;
            default:
              break;
          }
        } else {
          switch (transaction.status) {
            case State.TransactionStates.Cancelled:
            case State.TransactionStates.Compensated:
            case State.TransactionStates.Failed:
            case State.TransactionStates.Completed:
              sendUpdate({
                transactionId: parentTransactionId,
                taskId: parentTaskId,
                status: State.TaskStates.Completed,
                output: transaction.output,
              });
              break;
            default:
              break;
          }
        }
      }

      // Clean up instance store when transaction finished
      // If it have parent let parent clean by themself
      if (parentTransactionId && parentTaskId) {
        if (
          [
            State.TransactionStates.Cancelled,
            State.TransactionStates.Compensated,
          ].includes(transactionUpdate.status)
        ) {
          await this.delete(transactionUpdate.transactionId);
        }
      } else {
        if (
          [
            State.TransactionStates.Completed,
            State.TransactionStates.Failed,
            State.TransactionStates.Cancelled,
            State.TransactionStates.Compensated,
          ].includes(transactionUpdate.status)
        ) {
          await this.delete(transactionUpdate.transactionId);
        }
      }

      dg(
        `Updated ${transactionUpdate.transactionId} to ${transactionUpdate.status}`,
      );
      return transaction;
    } catch (error) {
      sendEvent({
        transactionId: transactionUpdate.transactionId,
        type: 'TRANSACTION',
        isError: true,
        timestamp: Date.now(),
        details: transactionUpdate,
        error: error.toString(),
      });
      return null;
    }
  };

  delete = async (transactionId: string) => {
    await Promise.all([
      this.client.delete(transactionId),
      workflowInstanceStore.deleteAll(transactionId),
    ]);
    dg(`Clean up ${transactionId}`);
  };

  list(from?: number, size?: number): Promise<Store.ITransactionPaginate> {
    return this.client.list(from, size);
  }

  compensate = async (
    transactionId: string,
    parent?: Transaction.ITransaction['parent'],
  ): Promise<void> => {
    if (parent) {
      this.client.changeParent(transactionId, parent);
    }

    const workflow = await workflowInstanceStore.getByTransactionId(
      transactionId,
    );

    if (workflow.status === State.WorkflowStates.Running) {
      await workflowInstanceStore.update({
        transactionId: workflow.workflowId,
        workflowId: workflow.workflowId,
        status: State.WorkflowStates.Cancelled,
      });
    } else if (workflow.status === State.WorkflowStates.Completed) {
      await workflowInstanceStore.compensate(
        workflow,
        Workflow.WorkflowTypes.CancelWorkflow,
        true,
      );
    }
  };

  isHealthy(): boolean {
    return this.client.isHealthy();
  }
}

export class WorkflowInstanceStore {
  client: IWorkflowInstanceStore;

  setClient(client: IWorkflowInstanceStore) {
    // if (this.client) throw new Error('Already set client');
    this.client = client;
  }

  get(workflowId: string): Promise<Workflow.IWorkflow> {
    return this.client.get(workflowId);
  }

  getByTransactionId(transactionId: string) {
    return this.client.getByTransactionId(transactionId);
  }

  create = async (
    transactionId: string,
    type: Workflow.WorkflowTypes,
    workflowDefinition: WorkflowDefinition.IWorkflowDefinition,
    input: any,
    overideWorkflow?: Workflow.IWorkflow | object,
  ): Promise<Workflow.IWorkflow> => {
    const timestamp = Date.now();
    const workflow = await this.client.create({
      transactionId,
      type,
      workflowId: undefined,
      status: State.WorkflowStates.Running,
      retries: R.pathOr(0, ['retry', 'limit'], workflowDefinition),
      input,
      output: null,
      createTime: timestamp,
      startTime: timestamp,
      endTime: null,
      workflowDefinition,
      transactionDepth: 0,
      ...overideWorkflow,
    });
    sendEvent({
      transactionId: workflow.transactionId,
      type: 'WORKFLOW',
      isError: false,
      timestamp,
      details: workflow,
    });

    await taskInstanceStore.create(workflow, [0], {}, { taskPath: [0] });

    return workflow;
  };

  updateWorkflowDefinition = async (
    workflowDefinitionUpdate: Event.IWorkflowDefinitionUpdate,
  ) => {
    try {
      const workflow = await this.client.updateWorkflowDefinition(
        workflowDefinitionUpdate,
      );
      return workflow;
    } catch (error) {
      return null;
    }
  };

  update = async (workflowUpdate: Event.IWorkflowUpdate) => {
    try {
      const timestamp = Date.now();
      const workflow = await this.client.update(workflowUpdate);
      sendEvent({
        transactionId: workflow.transactionId,
        type: 'WORKFLOW',
        isError: false,
        timestamp,
        details: workflow,
      });
      return workflow;
    } catch (error) {
      sendEvent({
        transactionId: workflowUpdate.transactionId,
        type: 'WORKFLOW',
        isError: true,
        error: error.toString(),
        details: workflowUpdate,
        timestamp: Date.now(),
      });
      return null;
    }
  };

  delete(workflowId: string, keepSubTransaction?: boolean) {
    return this.client.delete(workflowId, keepSubTransaction);
  }

  deleteAll(transactionId: string, keepSubTransaction?: boolean) {
    return this.client.deleteAll(transactionId, keepSubTransaction);
  }

  reload = async (workflow: Workflow.IWorkflow) => {
    await this.client.delete(workflow.workflowId);
    await this.client.create({
      ...workflow,
      retries: workflow.retries - 1,
    });
  };

  private getCompenstateTasks = (
    tasks: Task.ITask[],
    includeWorkers: boolean,
  ): WorkflowDefinition.Tasks => {
    return tasks
      .filter((task: Task.ITask) => {
        return includeWorkers
          ? (task.type === Task.TaskTypes.Task ||
              task.type === Task.TaskTypes.SubTransaction) &&
              task.status === State.TaskStates.Completed
          : task.type === Task.TaskTypes.SubTransaction &&
              task.status === State.TaskStates.Completed;
      })
      .sort((taskA: Task.ITask, taskB: Task.ITask): number => {
        return taskB.endTime - taskA.endTime;
      })
      .map(
        (task: Task.ITask): WorkflowDefinition.AllTaskType => {
          if (task.type === Task.TaskTypes.Task) {
            return {
              name: task.taskName,
              taskReferenceName: task.taskReferenceName,
              type: Task.TaskTypes.Compensate,
              inputParameters: {
                input: `\${workflow.input.${task.taskReferenceName}.input}`,
                output: `\${workflow.input.${task.taskReferenceName}.output}`,
              },
            };
          } else {
            return {
              taskReferenceName: task.taskReferenceName,
              type: Task.TaskTypes.SubTransaction,
              inputParameters: task.input,
            };
          }
        },
      );
  };

  // Delete current workflow and create oposite one
  // Return number of tasks to compensate
  compensate = async (
    workflow: Workflow.IWorkflow,
    workflowType: Workflow.WorkflowTypes,
    includeWorkers: boolean,
  ): Promise<number> => {
    const tasksData = await taskInstanceStore.getAll(workflow.workflowId);
    const isHaveRunningTask = !!tasksData.find((task: Task.ITask) =>
      [State.TaskStates.Scheduled, State.TaskStates.Inprogress].includes(
        task.status,
      ),
    );

    if (isHaveRunningTask) throw new Error(`Have running task`);

    const compenstateTasks = this.getCompenstateTasks(
      tasksData,
      includeWorkers,
    );

    await this.client.delete(workflow.workflowId, true);

    if (compenstateTasks.length) {
      await this.create(
        workflow.transactionId,
        workflowType,
        {
          name: workflow.workflowDefinition.name,
          rev: `${workflow.workflowDefinition.rev}_compensation`,
          tasks: compenstateTasks,
          failureStrategy: State.WorkflowFailureStrategies.Failed,
          outputParameters: {},
          retry: {
            limit: workflow.retries,
          },
        },
        toObjectByKey(tasksData, 'taskReferenceName'),
      );
    }

    return compenstateTasks.length;
  };

  isHealthy(): boolean {
    return this.client.isHealthy();
  }
}

export class TaskInstanceStore {
  client: ITaskInstanceStore;

  setClient(client: ITaskInstanceStore) {
    // if (this.client) throw new Error('Already set client');
    this.client = client;
  }

  get(taskId: string) {
    return this.client.get(taskId);
  }

  getAll(workflowId: string) {
    return this.client.getAll(workflowId);
  }

  reload = async (
    taskData: Task.ITask,
    willDispatch: boolean = false,
  ): Promise<Task.ITask> => {
    const workflow = await workflowInstanceStore.get(taskData.workflowId);
    if (!R.propEq('status', State.WorkflowStates.Running, workflow))
      throw new Error('WORKFLOW_NOT_RUNNING');

    await this.delete(taskData.taskId);

    const timestamp = Date.now() + (taskData.retryDelay || 0);
    const task = await this.client.create(
      R.omit(['_id'], {
        ...taskData,
        taskId: undefined,
        status: State.TaskStates.Scheduled,
        output: {},
        createTime: timestamp,
        startTime: timestamp,
        endTime: null,
      }),
    );

    if (willDispatch) {
      dispatch(task);
      sendEvent({
        transactionId: task.transactionId,
        type: 'TASK',
        isError: false,
        timestamp,
        details: task,
      });
    } else {
      sendTimer({
        type: Timer.TimerTypes.delayTask,
        task,
      });
    }

    return task;
  };

  // tslint:disable-next-line: max-func-body-length
  private createSystemTask = async (
    workflow: Workflow.IWorkflow,
    taskPath: (string | number)[],
    tasksData: { [taskReferenceName: string]: Task.ITask },
    overideTask: Task.ITask | object = {},
  ): Promise<Task.ITask> => {
    // Modeling task instance data
    const workflowTask:
      | WorkflowDefinition.IDecisionTask
      | WorkflowDefinition.IParallelTask
      | WorkflowDefinition.IScheduleTask
      | WorkflowDefinition.ISubTransactionTask = R.path(
      ['workflowDefinition', 'tasks', ...taskPath],
      workflow,
    );
    const timestampCreate = Date.now();
    const taskData: Task.ITask = {
      taskId: undefined,
      taskName: '',
      taskReferenceName: workflowTask.taskReferenceName,
      workflowId: workflow.workflowId,
      transactionId: workflow.transactionId,
      type: workflowTask.type,
      status: State.TaskStates.Scheduled,
      isRetried: false,
      input: mapParametersToValue(workflowTask.inputParameters, {
        ...tasksData,
        workflow,
      }),
      output: {},
      createTime: timestampCreate,
      startTime: timestampCreate,
      endTime: null,
      parallelTasks:
        workflowTask.type === Task.TaskTypes.Parallel
          ? workflowTask.parallelTasks
          : undefined,
      decisions:
        workflowTask.type === Task.TaskTypes.Decision
          ? workflowTask.decisions
          : undefined,
      defaultDecision:
        workflowTask.type === Task.TaskTypes.Decision
          ? workflowTask.defaultDecision
          : undefined,
      retries: 0,
      retryDelay: 0,
      ackTimeout: 0,
      timeout: 0,
      taskPath,
      ...overideTask,
    };

    try {
      if (workflowTask.type === Task.TaskTypes.Schedule) {
        // Send to time keeper
        const task = await this.client.create(taskData);
        sendEvent({
          transactionId: workflow.transactionId,
          type: 'TASK',
          isError: false,
          timestamp: timestampCreate,
          details: {
            ...task,
            status: State.TaskStates.Scheduled,
          },
        });
        sendTimer({
          type: Timer.TimerTypes.scheduleTask,
          taskId: task.taskId,
          transactionId: task.transactionId,
          completedAt: getCompltedAt(task),
        });

        return task;
      } else if (workflowTask.type === Task.TaskTypes.SubTransaction) {
        const task = await this.client.create(taskData);
        sendEvent({
          transactionId: workflow.transactionId,
          type: 'TASK',
          isError: false,
          timestamp: timestampCreate,
          details: {
            ...task,
            status: State.TaskStates.Scheduled,
          },
        });

        if (workflow.type === Workflow.WorkflowTypes.Workflow) {
          const workflowDefinition = await workflowDefinitionStore.get(
            task.input?.workflowName,
            task.input?.workflowRev,
          );

          if (workflow.transactionDepth >= 5) {
            // Maximum level of sub transaction is 5 (for now)
            sendUpdate({
              transactionId: task.transactionId,
              taskId: task.taskId,
              status: State.TaskStates.Failed,
              doNotRetry: true,
              isSystem: true,
              output: {
                error: `Maximum level of sub transaction exceeded`,
              },
            });
            return task;
          }

          if (workflowDefinition) {
            await transactionInstanceStore.create(
              `${workflow.transactionId}-${task.taskReferenceName}`,
              workflowDefinition,
              task.input?.input,
              [Task.TaskTypes.SubTransaction],
              {
                transactionId: workflow.transactionId,
                taskId: task.taskId,
                isCompensate: false,
                depth: workflow.transactionDepth + 1, // increase depth by 1
              },
            );

            return this.update({
              transactionId: task.transactionId,
              taskId: task.taskId,
              status: State.TaskStates.Inprogress,
              isSystem: true,
            });
          } else {
            sendUpdate({
              transactionId: task.transactionId,
              taskId: task.taskId,
              status: State.TaskStates.Failed,
              doNotRetry: true,
              isSystem: true,
              output: {
                error: `Workflow definition not found`,
              },
            });
            return task;
          }
        } else {
          // For compensate inception XD
          await transactionInstanceStore.compensate(
            `${workflow.transactionId}-${task.taskReferenceName}`,
            {
              taskId: task.taskId,
              transactionId: task.transactionId,
              isCompensate: true,
              depth: workflow.transactionDepth, // do not +1
            },
          );
          return this.update({
            transactionId: task.transactionId,
            taskId: task.taskId,
            status: State.TaskStates.Inprogress,
            isSystem: true,
          });
        }
      } else {
        // Dispatch child task(s)
        switch (workflowTask.type) {
          case Task.TaskTypes.Decision:
            await this.create(
              workflow,
              workflowTask.decisions?.[taskData.input?.case]
                ? [...taskPath, 'decisions', taskData.input?.case, 0]
                : [...taskPath, 'defaultDecision', 0],
              tasksData,
            );
            break;
          case Task.TaskTypes.Parallel:
            await Promise.all(
              taskData.parallelTasks.map(
                (_tasks: WorkflowDefinition.AllTaskType[], index: number) =>
                  this.create(
                    workflow,
                    [...taskPath, 'parallelTasks', index, 0],
                    tasksData,
                  ),
              ),
            );
            break;
        }
        // Create task instance

        const timestamp = Date.now();
        const task = await this.client.create({
          ...taskData,
          status: State.TaskStates.Inprogress,
        });

        sendEvent({
          transactionId: workflow.transactionId,
          type: 'TASK',
          isError: false,
          timestamp: timestampCreate,
          details: {
            ...task,
            status: State.TaskStates.Scheduled,
          },
        });

        sendEvent({
          transactionId: workflow.transactionId,
          type: 'TASK',
          isError: false,
          timestamp,
          details: task,
        });
        return task;
      }
    } catch (error) {
      const task = await this.client.create({
        ...taskData,
        status: State.TaskStates.Failed,
        output: {
          error: error.toString(),
        },
      });

      sendEvent({
        transactionId: workflow.transactionId,
        type: 'TASK',
        isError: false,
        timestamp: Date.now(),
        details: task,
      });

      return task;
    }
  };

  private createWorkerTask = async (
    workflow: Workflow.IWorkflow,
    taskPath: (string | number)[],
    tasksData: { [taskReferenceName: string]: Task.ITask },
    overideTask: Task.ITask | object = {},
  ): Promise<Task.ITask> => {
    const workflowTask:
      | WorkflowDefinition.ICompensateTask
      | WorkflowDefinition.ITaskTask = R.path(
      ['workflowDefinition', 'tasks', ...taskPath],
      workflow,
    );
    const taskDefinition = await taskDefinitionStore.get(workflowTask.name);

    const timestamp = Date.now();
    const task = await this.client.create({
      taskId: undefined,
      taskName: workflowTask.name,
      taskReferenceName: workflowTask.taskReferenceName,
      workflowId: workflow.workflowId,
      transactionId: workflow.transactionId,
      type: workflowTask.type,
      status: State.TaskStates.Scheduled,
      isRetried: false,
      input: mapParametersToValue(workflowTask.inputParameters, {
        ...tasksData,
        workflow,
      }),
      output: {},
      createTime: timestamp,
      startTime: timestamp,
      endTime: null,
      retries: R.pathOr(
        R.pathOr(0, ['retry', 'limit'], taskDefinition),
        ['retry', 'limit'],
        workflowTask,
      ),
      retryDelay: R.pathOr(
        R.pathOr(0, ['retry', 'delay'], taskDefinition),
        ['retry', 'delay'],
        workflowTask,
      ),
      ackTimeout: R.pathOr(
        R.propOr(0, 'ackTimeout', taskDefinition),
        ['ackTimeout'],
        workflowTask,
      ),
      timeout: R.pathOr(
        R.propOr(0, 'timeout', taskDefinition),
        ['timeout'],
        workflowTask,
      ),
      taskPath,
      ...overideTask,
    });

    dispatch(task);
    sendEvent({
      transactionId: workflow.transactionId,
      type: 'TASK',
      isError: false,
      timestamp,
      details: task,
    });
    return task;
  };

  create = async (
    workflow: Workflow.IWorkflow,
    taskPath: (string | number)[],
    tasksData: { [taskReferenceName: string]: Task.ITask },
    overideTask: Task.ITask | object = {},
  ): Promise<Task.ITask> => {
    switch (
      R.path(['workflowDefinition', 'tasks', ...taskPath, 'type'], workflow)
    ) {
      case Task.TaskTypes.Decision:
      case Task.TaskTypes.Parallel:
      case Task.TaskTypes.Schedule:
      case Task.TaskTypes.SubTransaction:
        return this.createSystemTask(
          workflow,
          taskPath,
          tasksData,
          overideTask,
        );
      case Task.TaskTypes.Task:
      case Task.TaskTypes.Compensate:
      default:
        return this.createWorkerTask(
          workflow,
          taskPath,
          tasksData,
          overideTask,
        );
    }
  };

  update = async (taskUpdate: Event.ITaskUpdate): Promise<Task.ITask> => {
    try {
      const timestamp = Date.now();
      const task = await this.client.update(taskUpdate);
      sendEvent({
        transactionId: task.transactionId,
        type: 'TASK',
        isError: false,
        timestamp,
        details: task,
      });
      return task;
    } catch (error) {
      sendEvent({
        transactionId: taskUpdate.transactionId,
        type: 'TASK',
        isError: true,
        error: error.toString(),
        details: taskUpdate,
        timestamp: Date.now(),
      });
      return null;
    }
  };

  delete(taskId: string, keepSubTransaction?: boolean): Promise<any> {
    return this.client.delete(taskId, keepSubTransaction);
  }

  deleteAll = (workflowId: string, keepSubTransaction?: boolean) => {
    return this.client.deleteAll(workflowId, keepSubTransaction);
  };

  isHealthy(): boolean {
    return this.client.isHealthy();
  }
}

// This's global instance
export const taskDefinitionStore = new TaskDefinitionStore();
export const workflowDefinitionStore = new WorkflowDefinitionStore();
export const taskInstanceStore = new TaskInstanceStore();
export const workflowInstanceStore = new WorkflowInstanceStore();
export const transactionInstanceStore = new TransactionInstanceStore();

export const isHealthy = () =>
  R.all(R.equals(true), [
    transactionInstanceStore.isHealthy(),
    workflowInstanceStore.isHealthy(),
    taskInstanceStore.isHealthy(),
    workflowDefinitionStore.isHealthy(),
    taskDefinitionStore.isHealthy(),
  ]);
