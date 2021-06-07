import koaRouter = require('koa-router');
import { State } from '@melonade/melonade-declaration';
import { CommandTypes } from '@melonade/melonade-declaration/build/command';
import { ITaskUpdate } from '@melonade/melonade-declaration/build/event';
import * as uuid from 'uuid/v4';
import {
  processCancelTransactionCommand,
  processStartTransactionCommand,
} from '../../../../command';
import { handleCompletedTask, handleFailedTask } from '../../../../state';
import {
  distributedLockStore,
  taskInstanceStore,
  transactionInstanceStore,
} from '../../../../store';

export const router = new koaRouter();

router.post('/:name/:rev', async (ctx: koaRouter.IRouterContext) => {
  const { name, rev } = ctx.params;
  const { transactionId, tags } = ctx.query;

  console.log(
    `rest name/rev start transaction: ${transactionId} | ${ctx.request.url}`,
  );

  return processStartTransactionCommand({
    transactionId: transactionId || uuid(),
    workflowRef: {
      name,
      rev,
    },
    input: ctx.request.body,
    type: CommandTypes.StartTransaction,
    tags: tags ? JSON.parse(tags) : [],
  });
});

router.post('/start', async (ctx: koaRouter.IRouterContext) => {
  const { transactionId, tags } = ctx.query;

  console.log(
    `rest body start transaction: ${transactionId} | ${ctx.request.url}`,
  );

  return processStartTransactionCommand({
    transactionId: transactionId || uuid(),
    workflowDefinition: ctx.request.body.workflowDefinition,
    input: ctx.request.body.input,
    type: CommandTypes.StartTransaction,
    tags: tags ? JSON.parse(tags) : [],
  });
});

router.delete('/cancel/:transactionId', (ctx: koaRouter.IRouterContext) => {
  const { transactionId, reason } = ctx.params;

  return processCancelTransactionCommand({
    type: CommandTypes.CancelTransaction,
    transactionId: transactionId,
    reason: reason || 'Cancel with web',
  });
});

router.get('/', (ctx: koaRouter.IRouterContext) => {
  const { from = 0, size = 50 } = ctx.query;
  return transactionInstanceStore.list(+from, +size);
});

router.post('/update', async (ctx: koaRouter.IRouterContext) => {
  const taskUpdate: ITaskUpdate = ctx.request.body;

  const locker = await distributedLockStore.lock(taskUpdate.transactionId);
  try {
    const task = await taskInstanceStore.update(taskUpdate);
    if (!task) {
      throw new Error('Cannot update');
    }

    switch (taskUpdate.status) {
      case State.TaskStates.Completed:
        await handleCompletedTask(task);
        break;
      case State.TaskStates.Failed:
      case State.TaskStates.Timeout:
      case State.TaskStates.AckTimeOut:
        await handleFailedTask(task, taskUpdate.doNotRetry);
        break;
      default:
        // Case Inprogress we did't need to do anything except update the status
        break;
    }

    await locker.unlock();
    return task;
  } catch (error) {
    console.log(error);
    await locker.unlock();
    throw error;
  }
});
