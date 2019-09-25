import * as R from 'ramda';
import { IWorkflowDefinition, AllTaskType } from '../workflowDefinition';
import { ITaskDefinition } from '../taskDefinition';
import { IWorkflow } from '../workflow';
import { ITask } from '../task';
import { WorkflowStates, WorkflowTypes } from '../constants/workflow';
import { TaskStates, TaskTypes } from '../constants/task';
import { mapParametersToValue } from '../utils/task';
import { dispatch, sendEvent } from '../kafka';
import { ITaskUpdate, IWorkflowUpdate, ITransactionUpdate } from '../state';
import { ITransaction } from '../transaction';
import { TransactionStates } from '../constants/transaction';

export interface IStore {
  isHealthy(): boolean;
}

export interface IWorkflowDefinitionStore extends IStore {
  get(name: string, rev: string): Promise<IWorkflowDefinition>;
  create(workflowDefinition: IWorkflowDefinition): Promise<IWorkflowDefinition>;
  list(): Promise<IWorkflowDefinition[]>;
}

export interface ITaskDefinitionStore extends IStore {
  get(name: string): Promise<ITaskDefinition>;
  create(taskDefinition: ITaskDefinition): Promise<ITaskDefinition>;
  update(taskDefinition: ITaskDefinition): Promise<ITaskDefinition>;
  list(): Promise<ITaskDefinition[]>;
}

export interface ITransactionInstanceStore extends IStore {
  get(workflowId: string): Promise<ITransaction>;
  create(wofkflowData: ITransaction): Promise<ITransaction>;
  update(workflowUpdate: ITransactionUpdate): Promise<ITransaction>;
}
export interface IWorkflowInstanceStore extends IStore {
  get(workflowId: string): Promise<IWorkflow>;
  create(wofkflowData: IWorkflow): Promise<IWorkflow>;
  update(workflowUpdate: IWorkflowUpdate): Promise<IWorkflow>;
  delete(workflowId: string): Promise<any>;
}

export interface ITaskInstanceStore extends IStore {
  get(taskId: string): Promise<ITask>;
  getAll(workflowId: string): Promise<ITask[]>;
  create(taskData: ITask): Promise<ITask>;
  update(taskUpdate: ITaskUpdate): Promise<ITask>;
  delete(taskId: string): Promise<any>;
  deleteAll(workflowId: string): Promise<any>;
}

export class WorkflowDefinitionStore {
  client: IWorkflowDefinitionStore;

  setClient(client: IWorkflowDefinitionStore) {
    if (this.client) throw new Error('Already set client');
    this.client = client;
  }

  get(name: string, rev: string): Promise<IWorkflowDefinition> {
    return this.client.get(name, rev);
  }

  list(): Promise<IWorkflowDefinition[]> {
    return this.client.list();
  }

  create(
    workflowDefinition: IWorkflowDefinition,
  ): Promise<IWorkflowDefinition> {
    return this.client.create(workflowDefinition);
  }
}

export class TaskDefinitionStore {
  client: ITaskDefinitionStore;

  setClient(client: ITaskDefinitionStore) {
    if (this.client) throw new Error('Already set client');
    this.client = client;
  }

  get(name: string): Promise<ITaskDefinition> {
    return this.client.get(name);
  }

  list(): Promise<ITaskDefinition[]> {
    return this.client.list();
  }

  create(taskDefinition: ITaskDefinition): Promise<ITaskDefinition> {
    return this.client.create(taskDefinition);
  }

  update(taskDefinition: ITaskDefinition): Promise<ITaskDefinition> {
    return this.client.update(taskDefinition);
  }
}

export class TransactionInstanceStore {
  client: ITransactionInstanceStore;

  setClient(client: ITransactionInstanceStore) {
    if (this.client) throw new Error('Already set client');
    this.client = client;
  }

  get(transactionId: string): Promise<ITransaction> {
    return this.client.get(transactionId);
  }

  create = async (
    transactionId: string,
    workflowDefinition: IWorkflowDefinition,
    input: any,
  ): Promise<ITransaction> => {
    const transaction = await this.client.create({
      transactionId,
      status: TransactionStates.Running,
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
      WorkflowTypes.Workflow,
      workflowDefinition,
      input,
    );

    return transaction;
  };

  update = async (transactionUpdate: ITransactionUpdate) => {
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

  get(workflowId: string): Promise<IWorkflow> {
    return this.client.get(workflowId);
  }

  create = async (
    transactionId: string,
    type: WorkflowTypes,
    workflowDefinition: IWorkflowDefinition,
    input: any,
    childOf?: string,
    overideWorkflow?: IWorkflow | object,
  ): Promise<IWorkflow> => {
    const workflow = await this.client.create({
      transactionId,
      type,
      workflowId: undefined,
      status: WorkflowStates.Running,
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

  update = async (workflowUpdate: IWorkflowUpdate) => {
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

  reload = async (taskData: ITask): Promise<ITask> => {
    await this.delete(taskData.taskId);
    const task = await this.client.create(
      R.omit(['_id'], {
        ...taskData,
        taskId: undefined,
        status: TaskStates.Scheduled,
        output: {},
        createTime: Date.now(),
        startTime: Date.now(),
        endTime: null,
      }),
    );
    dispatch(
      task,
      task.transactionId,
      ![TaskTypes.Task, TaskTypes.Compensate].includes(task.type),
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
    workflow: IWorkflow,
    workflowTask: AllTaskType,
    tasksData: { [taskReferenceName: string]: ITask },
    autoDispatch: boolean = false,
    overideTask: ITask | object = {},
  ): Promise<ITask> => {
    const taskDefinition = await taskDefinitionStore.get(workflowTask.name);
    const task = await this.client.create({
      taskId: undefined,
      taskName: workflowTask.name,
      taskReferenceName: workflowTask.taskReferenceName,
      workflowId: workflow.workflowId,
      transactionId: workflow.transactionId,
      type: workflowTask.type,
      status: TaskStates.Scheduled,
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
        workflowTask.type === TaskTypes.Parallel
          ? workflowTask.parallelTasks
          : undefined,
      decisions:
        workflowTask.type === TaskTypes.Decision
          ? workflowTask.decisions
          : undefined,
      defaultDecision:
        workflowTask.type === TaskTypes.Decision
          ? workflowTask.defaultDecision
          : undefined,
      workflow:
        workflowTask.type === TaskTypes.SubWorkflow
          ? workflowTask.workflow
          : undefined,
      retries: R.pathOr(
        taskDefinition.retry.limit,
        ['retry', 'limit'],
        workflowTask,
      ),
      retryDelay: R.pathOr(
        taskDefinition.retry.delay,
        ['retry', 'delay'],
        workflowTask,
      ),
      ackTimeout: R.pathOr(
        taskDefinition.ackTimeout,
        ['ackTimeout'],
        workflowTask,
      ),
      timeout: R.pathOr(taskDefinition.timeout, ['timeout'], workflowTask),
      ...overideTask,
    });

    if (autoDispatch) {
      dispatch(
        task,
        workflow.transactionId,
        ![TaskTypes.Task, TaskTypes.Compensate].includes(workflowTask.type),
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

  update = async (taskUpdate: ITaskUpdate): Promise<ITask> => {
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
        error,
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
