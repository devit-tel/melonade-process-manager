import {
  State,
  Task,
  WorkflowDefinition,
} from '@melonade/melonade-declaration';
import * as kafka from '../kafka';
import * as state from '../state';
import {
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

jest.mock('../kafka');
jest.spyOn(transactionInstanceStore, 'create');
jest.spyOn(transactionInstanceStore, 'update');
jest.spyOn(workflowInstanceStore, 'create');
jest.spyOn(workflowInstanceStore, 'update');
jest.spyOn(taskInstanceStore, 'create');
jest.spyOn(taskInstanceStore, 'update');

const mockedDispatch = <jest.Mock<typeof kafka.dispatch>>kafka.dispatch;

beforeAll(() => {
  taskDefinitionStore.setClient(new TaskDefinitionMemoryStore());
  workflowDefinitionStore.setClient(new WorkflowDefinitionMemoryStore());
  taskInstanceStore.setClient(new TaskInstanceMemoryStore());
  workflowInstanceStore.setClient(new WorkflowInstanceMemoryStore());
  transactionInstanceStore.setClient(new TransactionInstanceMemoryStore());
});

describe('Ideal workflow', () => {
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

    expect(mockedDispatch).toBeCalledTimes(1);
    await state.processUpdatedTasks([
      {
        taskId: currentTask.taskId,
        isSystem: false,
        transactionId: currentTask.transactionId,
        status: State.TaskStates.Completed,
      },
    ]);

    dispatchedTasks.push(mockedDispatch.mock.calls[1][0]);
    expect(mockedDispatch).toBeCalledTimes(2);
    expect(transactionInstanceStore.create).toBeCalledTimes(1);
    expect(transactionInstanceStore.update).toBeCalledTimes(0);
    expect(workflowInstanceStore.create).toBeCalledTimes(1);
    expect(workflowInstanceStore.update).toBeCalledTimes(0);
    expect(taskInstanceStore.create).toBeCalledTimes(2);
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

    expect(mockedDispatch).toBeCalledTimes(2);
    await state.processUpdatedTasks([
      {
        taskId: currentTask.taskId,
        isSystem: false,
        transactionId: currentTask.transactionId,
        status: State.TaskStates.Completed,
      },
    ]);

    dispatchedTasks.push(mockedDispatch.mock.calls[2][0]);
    expect(mockedDispatch).toBeCalledTimes(3);
    expect(transactionInstanceStore.create).toBeCalledTimes(1);
    expect(transactionInstanceStore.update).toBeCalledTimes(0);
    expect(workflowInstanceStore.create).toBeCalledTimes(1);
    expect(workflowInstanceStore.update).toBeCalledTimes(0);
    expect(taskInstanceStore.create).toBeCalledTimes(3);
    expect(taskInstanceStore.update).toBeCalledTimes(4);
  });

  test('Transaction, workflow must in running state', async () => {
    const transaction = await transactionInstanceStore.get('someTransactionId');
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

    expect(mockedDispatch).toBeCalledTimes(3);
    await state.processUpdatedTasks([
      {
        taskId: currentTask.taskId,
        isSystem: false,
        transactionId: currentTask.transactionId,
        status: State.TaskStates.Completed,
      },
    ]);

    expect(mockedDispatch).toBeCalledTimes(3);
    expect(transactionInstanceStore.create).toBeCalledTimes(1);
    expect(transactionInstanceStore.update).toBeCalledTimes(1);
    expect(workflowInstanceStore.create).toBeCalledTimes(1);
    expect(workflowInstanceStore.update).toBeCalledTimes(1);
    expect(taskInstanceStore.create).toBeCalledTimes(3);
    expect(taskInstanceStore.update).toBeCalledTimes(6);
  });

  test('Instance data must be clean up', async () => {
    const transaction = await transactionInstanceStore.get('someTransactionId');
    expect(transaction).toEqual(undefined);
  });
});
