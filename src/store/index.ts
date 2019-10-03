import * as R from 'ramda';
import {
  WorkflowDefinition,
  TaskDefinition,
  Transaction,
  Workflow,
  Task,
  Event,
  State,
} from '@melonade/melonade-declaration';
import { mapParametersToValue } from '../utils/task';
import { dispatch, sendEvent } from '../kafka';

export enum StoreType {
  ZooKeeper = 'ZOOKEEPER', // Greate for Definition
  MongoDB = 'MONGODB',
  DynamoDB = 'DYNAMODB',
  Redis = 'REDIS', // Greate for Instance
  Memory = 'MEMORY', // For Dev/Test, don't use in production
}

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
}

export interface ITransactionInstanceStore extends IStore {
  get(workflowId: string): Promise<Transaction.ITransaction>;
  create(
    wofkflowData: Transaction.ITransaction,
  ): Promise<Transaction.ITransaction>;
  update(
    workflowUpdate: Event.ITransactionUpdate,
  ): Promise<Transaction.ITransaction>;
}
export interface IWorkflowInstanceStore extends IStore {
  get(workflowId: string): Promise<Workflow.IWorkflow>;
  create(wofkflowData: Workflow.IWorkflow): Promise<Workflow.IWorkflow>;
  update(workflowUpdate: Event.IWorkflowUpdate): Promise<Workflow.IWorkflow>;
  delete(workflowId: string): Promise<any>;
}

export interface ITaskInstanceStore extends IStore {
  get(taskId: string): Promise<Task.ITask>;
  getAll(workflowId: string): Promise<Task.ITask[]>;
  create(taskData: Task.ITask): Promise<Task.ITask>;
  update(taskUpdate: Event.ITaskUpdate): Promise<Task.ITask>;
  delete(taskId: string): Promise<any>;
  deleteAll(workflowId: string): Promise<any>;
}

export class WorkflowDefinitionStore {
  client: IWorkflowDefinitionStore;

  setClient(client: IWorkflowDefinitionStore) {
    if (this.client) throw new Error('Already set client');
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
}

export class TaskDefinitionStore {
  client: ITaskDefinitionStore;

  setClient(client: ITaskDefinitionStore) {
    if (this.client) throw new Error('Already set client');
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
}

export class TransactionInstanceStore {
  client: ITransactionInstanceStore;

  setClient(client: ITransactionInstanceStore) {
    if (this.client) throw new Error('Already set client');
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
        error,
      });
      return undefined;
    }
  };
}

export class WorkflowInstanceStore {
  client: IWorkflowInstanceStore;

  setClient(client: IWorkflowInstanceStore) {
    if (this.client) throw new Error('Already set client');
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
    childOf?: string,
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
      childOf,
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

    await taskInstanceStore.create(
      workflow,
      workflowDefinition.tasks[0],
      {},
      true,
    );

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
        error,
        details: workflowUpdate,
        timestamp: Date.now(),
      });
      return undefined;
    }
  };

  delete(workflowId: string) {
    return this.client.delete(workflowId);
  }
}

export class TaskInstanceStore {
  client: ITaskInstanceStore;

  setClient(client: ITaskInstanceStore) {
    if (this.client) throw new Error('Already set client');
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
    dispatch(
      task,
      task.transactionId,
      ![Task.TaskTypes.Task, Task.TaskTypes.Compensate].includes(task.type),
    );
    sendEvent({
      transactionId: task.transactionId,
      type: 'TASK',
      isError: false,
      timestamp: Date.now(),
      details: task,
    });
    return task;
  };

  create = async (
    workflow: Workflow.IWorkflow,
    workflowTask: WorkflowDefinition.AllTaskType,
    tasksData: { [taskReferenceName: string]: Task.ITask },
    autoDispatch: boolean = false,
    overideTask: Task.ITask | object = {},
  ): Promise<Task.ITask> => {
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
      startTime: autoDispatch ? Date.now() : null,
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
      workflow:
        workflowTask.type === Task.TaskTypes.SubWorkflow
          ? workflowTask.workflow
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
    });

    if (autoDispatch) {
      dispatch(
        task,
        workflow.transactionId,
        ![Task.TaskTypes.Task, Task.TaskTypes.Compensate].includes(
          workflowTask.type,
        ),
      );
      sendEvent({
        transactionId: workflow.transactionId,
        type: 'TASK',
        isError: false,
        timestamp: Date.now(),
        details: task,
      });
    }
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
      throw error;
    }
  };

  delete(taskId: string): Promise<any> {
    return this.client.delete(taskId);
  }

  deleteAll(workflowId: string): Promise<any> {
    return this.client.deleteAll(workflowId);
  }
}

// This's global instance
export const taskDefinitionStore = new TaskDefinitionStore();
export const workflowDefinitionStore = new WorkflowDefinitionStore();
export const taskInstanceStore = new TaskInstanceStore();
export const workflowInstanceStore = new WorkflowInstanceStore();
export const transactionInstanceStore = new TransactionInstanceStore();
