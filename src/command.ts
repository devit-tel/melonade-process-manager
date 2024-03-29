import {
  Command,
  State,
  Task,
  Transaction,
  WorkflowDefinition,
} from '@melonade/melonade-declaration';
import * as R from 'ramda';
import {
  commandConsumerClient,
  dispatch,
  pollWithMessage,
  sendEvent,
} from './kafka';
import { getTaskData, handleCancelWorkflow, processUpdateTask } from './state';
import {
  distributedLockStore,
  transactionInstanceStore,
  workflowDefinitionStore,
  workflowInstanceStore,
} from './store';
import { sleep } from './utils/common';

export const processStartTransactionCommand = async (
  command: Command.IStartTransactionCommand,
): Promise<Transaction.ITransaction> => {
  const workflowDefinition = command.workflowDefinition
    ? new WorkflowDefinition.WorkflowDefinition(command.workflowDefinition)
    : await workflowDefinitionStore.get(
        command.workflowRef.name,
        command.workflowRef.rev,
      );

  if (!workflowDefinition) throw new Error(`Workflow definition is not exists`);

  const locker = await distributedLockStore.lock(command.transactionId);
  try {
    const t = await transactionInstanceStore.create(
      command.transactionId,
      workflowDefinition,
      command.input,
      command.tags,
    );
    await locker.unlock();
    return t;
  } catch (error) {
    await locker.unlock();
    throw error;
  }
};

export const processCancelTransactionCommand = async (
  command: Command.ICancelTransactionCommand,
): Promise<void> => {
  const workflow = await workflowInstanceStore.getByTransactionId(
    command.transactionId,
  );

  const locker = await distributedLockStore.lock(command.transactionId);

  try {
    await workflowInstanceStore.update({
      transactionId: command.transactionId,
      status: State.WorkflowStates.Cancelled,
      workflowId: workflow.workflowId,
      output: {
        reason: command.reason,
      },
    });
    const tasksData = await getTaskData(workflow);
    const syncWorkerTasks = R.values(tasksData).filter(
      (t: Task.ITask) =>
        t.syncWorker === true || [Task.TaskTypes.Schedule].includes(t.type),
    );

    for (const t of syncWorkerTasks) {
      await processUpdateTask({
        status: State.TaskStates.Failed,
        taskId: t.taskId,
        transactionId: t.transactionId,
        isSystem: true,
        doNotRetry: true,
        output: {
          reason: 'Workflow has been cancelled',
        },
      });
    }

    await handleCancelWorkflow(workflow, tasksData);
  } catch (error) {
    console.log(error);
  }
  await locker.unlock();
};

const processReloadTaskCommand = (
  command: Command.IReloadTaskCommand,
): Task.ITask => {
  dispatch(command.task);
  sendEvent({
    transactionId: command.task.transactionId,
    type: 'TASK',
    isError: false,
    timestamp: Date.now(),
    details: command.task,
  });

  return command.task;
};

const processCommands = async (
  commands: Command.AllCommand[],
): Promise<void> => {
  for (const command of commands) {
    try {
      if (!command.transactionId) throw new Error('TransactionId is required');
      switch (command.type) {
        case Command.CommandTypes.StartTransaction:
          console.log(`command start transaction: ${command.transactionId}`);
          await processStartTransactionCommand(command);
          break;
        case Command.CommandTypes.CancelTransaction:
          console.log(`command cancel transaction: ${command.transactionId}`);
          await processCancelTransactionCommand(command);
          break;
        case Command.CommandTypes.ReloadTask:
          console.log(`command reload transaction: ${command.transactionId}`);
          await processReloadTaskCommand(command);
          break;
        default:
          throw new Error(`Command type "${command.type}" is invalid`);
      }
    } catch (error) {
      // Add some logger or send to event store
      console.log(error);
      sendEvent({
        transactionId: command.transactionId,
        type: 'SYSTEM',
        isError: true,
        details: command,
        error: error.toString(),
        timestamp: Date.now(),
      });
    }
  }
};

export const executor = async () => {
  while (true) {
    try {
      const [commands] = await pollWithMessage<Command.AllCommand>(
        commandConsumerClient,
      );
      if (commands.length) {
        await processCommands(commands);
        // @ts-ignore
        commandConsumerClient.commitSync();
      }
    } catch (error) {
      // Handle consume error
      console.warn('command', error);
      await sleep(1000);
    }
  }
};
