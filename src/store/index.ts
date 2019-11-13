import {
  Event,
  State,
  Task,
  TaskDefinition,
  Transaction,
  Workflow,
  WorkflowDefinition,
} from '@melonade/melonade-declaration';
import * as R from 'ramda';
import { dispatch, sendEvent } from '../kafka';
import { mapParametersToValue } from '../utils/task';

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
  list(): Promise<{
    [name: string]: { [rev: string]: WorkflowDefinition.IWorkflowDefinition };
  }>;
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
  list(): Promise<{ [name: string]: TaskDefinition.ITaskDefinition }>;
  isHealthy(): boolean;
}

export interface ITransactionInstanceStore extends IStore {
  get(workflowId: string): Promise<Transaction.ITransaction>;
  create(
    wofkflowData: Transaction.ITransaction,
  ): Promise<Transaction.ITransaction>;
  update(
    workflowUpdate: Event.ITransactionUpdate,
  ): Promise<Transaction.ITransaction>;
  isHealthy(): boolean;
}

export interface IWorkflowInstanceStore extends IStore {
  get(workflowId: string): Promise<Workflow.IWorkflow>;
  create(wofkflowData: Workflow.IWorkflow): Promise<Workflow.IWorkflow>;
  update(workflowUpdate: Event.IWorkflowUpdate): Promise<Workflow.IWorkflow>;
  delete(workflowId: string): Promise<any>;
  getByTransactionId(transactionId: string): Promise<Workflow.IWorkflow>;
  deleteAll(transactionId: string): Promise<void>;
  isHealthy(): boolean;
}

export interface ITaskInstanceStore extends IStore {
  get(taskId: string): Promise<Task.ITask>;
  getAll(workflowId: string): Promise<Task.ITask[]>;
  create(taskData: Task.ITask): Promise<Task.ITask>;
  update(taskUpdate: Event.ITaskUpdate): Promise<Task.ITask>;
  delete(taskId: string): Promise<any>;
  deleteAll(workflowId: string): Promise<void>;
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

  list(): Promise<{
    [name: string]: { [rev: string]: WorkflowDefinition.IWorkflowDefinition };
  }> {
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

  list(): Promise<{ [name: string]: TaskDefinition.ITaskDefinition }> {
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
  ): Promise<Transaction.ITransaction> => {
    const transaction = await this.client.create({
      transactionId,
      status: State.TransactionStates.Running,
      input,
      output: null,
      createTime: Date.now(),
      endTime: null,
      workflowDefinition,
    });
    sendEvent({
      transactionId,
      type: 'TRANSACTION',
      isError: false,
      timestamp: Date.now(),
      details: transaction,
    });

    await workflowInstanceStore.create(
      transactionId,
      Workflow.WorkflowTypes.Workflow,
      workflowDefinition,
      input,
    );

    return transaction;
  };

  update = async (transactionUpdate: Event.ITransactionUpdate) => {
    try {
      const transaction = await this.client.update(transactionUpdate);
      sendEvent({
        transactionId: transactionUpdate.transactionId,
        type: 'TRANSACTION',
        isError: false,
        timestamp: Date.now(),
        details: transaction,
      });
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

  create = async (
    transactionId: string,
    type: Workflow.WorkflowTypes,
    workflowDefinition: WorkflowDefinition.IWorkflowDefinition,
    input: any,
    overideWorkflow?: Workflow.IWorkflow | object,
  ): Promise<Workflow.IWorkflow> => {
    const workflow = await this.client.create({
      transactionId,
      type,
      workflowId: undefined,
      status: State.WorkflowStates.Running,
      retries: R.pathOr(0, ['retry', 'limit'], workflowDefinition),
      input,
      output: null,
      createTime: Date.now(),
      startTime: Date.now(),
      endTime: null,
      workflowDefinition,
      ...overideWorkflow,
    });
    sendEvent({
      transactionId: workflow.transactionId,
      type: 'WORKFLOW',
      isError: false,
      timestamp: Date.now(),
      details: workflow,
    });

    await taskInstanceStore.create(workflow, workflowDefinition.tasks[0], {});

    return workflow;
  };

  update = async (workflowUpdate: Event.IWorkflowUpdate) => {
    try {
      const workflow = await this.client.update(workflowUpdate);
      sendEvent({
        transactionId: workflow.transactionId,
        type: 'WORKFLOW',
        isError: false,
        timestamp: Date.now(),
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

  delete(workflowId: string) {
    return this.client.delete(workflowId);
  }

  getByTransactionId(transactionId: string) {
    return this.client.getByTransactionId(transactionId);
  }

  deleteAll(transactionId: string) {
    return this.client.deleteAll(transactionId);
  }

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

  reload = async (taskData: Task.ITask): Promise<Task.ITask> => {
    await this.delete(taskData.taskId);
    const task = await this.client.create(
      R.omit(['_id'], {
        ...taskData,
        taskId: undefined,
        status: State.TaskStates.Scheduled,
        output: {},
        createTime: Date.now(),
        startTime: Date.now(),
        endTime: null,
      }),
    );
    dispatch(task);
    sendEvent({
      transactionId: task.transactionId,
      type: 'TASK',
      isError: false,
      timestamp: Date.now(),
      details: task,
    });
    return task;
  };

  // tslint:disable-next-line: max-func-body-length
  private createSystemTask = async (
    workflow: Workflow.IWorkflow,
    workflowTask: WorkflowDefinition.AllTaskType,
    tasksData: { [taskReferenceName: string]: Task.ITask },
    overideTask: Task.ITask | object = {},
  ) => {
    // Modeling task instance data
    const taskDefinition = await taskDefinitionStore.get(workflowTask.name);
    const taskData: Task.ITask = {
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
      createTime: Date.now(),
      startTime: Date.now(),
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
      ...overideTask,
    };

    sendEvent({
      transactionId: workflow.transactionId,
      type: 'TASK',
      isError: false,
      timestamp: Date.now(),
      details: taskData,
    });

    try {
      // Dispatch child task(s)
      switch (workflowTask.type) {
        case Task.TaskTypes.Decision:
          await taskInstanceStore.create(
            workflow,
            workflowTask.decisions[taskData.input.case]
              ? workflowTask.decisions[taskData.input.case][0]
              : workflowTask.defaultDecision[0],
            tasksData,
          );
          break;
        case Task.TaskTypes.Parallel:
          await Promise.all(
            taskData.parallelTasks.map(
              (tasks: WorkflowDefinition.AllTaskType[]) =>
                taskInstanceStore.create(workflow, tasks[0], tasksData),
            ),
          );
          break;
      }
      // Create task instance
      const task = await this.client.create({
        ...taskData,
        status: State.TaskStates.Inprogress,
      });

      sendEvent({
        transactionId: workflow.transactionId,
        type: 'TASK',
        isError: false,
        timestamp: Date.now(),
        details: task,
      });
      return task;
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

  create = async (
    workflow: Workflow.IWorkflow,
    workflowTask: WorkflowDefinition.AllTaskType,
    tasksData: { [taskReferenceName: string]: Task.ITask },
    overideTask: Task.ITask | object = {},
  ): Promise<Task.ITask> => {
    if (
      [Task.TaskTypes.Decision, Task.TaskTypes.Parallel].includes(
        workflowTask.type,
      )
    ) {
      return this.createSystemTask(
        workflow,
        workflowTask,
        tasksData,
        overideTask,
      );
    }

    const taskDefinition = await taskDefinitionStore.get(workflowTask.name);
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
      createTime: Date.now(),
      startTime: Date.now(),
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
      ...overideTask,
    });

    dispatch(task);
    sendEvent({
      transactionId: workflow.transactionId,
      type: 'TASK',
      isError: false,
      timestamp: Date.now(),
      details: task,
    });
    return task;
  };

  update = async (taskUpdate: Event.ITaskUpdate): Promise<Task.ITask> => {
    try {
      const task = await this.client.update(taskUpdate);
      sendEvent({
        transactionId: taskUpdate.transactionId,
        type: 'TASK',
        isError: false,
        timestamp: Date.now(),
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

  delete(taskId: string): Promise<any> {
    return this.client.delete(taskId);
  }

  deleteAll(workflowId: string) {
    return this.client.deleteAll(workflowId);
  }

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
