import koaRouter = require('koa-router');
import { WorkflowDefinition } from '@melonade/melonade-declaration';
import { CommandTypes } from '@melonade/melonade-declaration/build/command';
import * as uuid from 'uuid/v4';
import { processCancelTransactionCommand } from '../../../../command';
import { processUpdateTasks } from '../../../../state';
import {
  transactionInstanceStore,
  workflowDefinitionStore,
} from '../../../../store';

export const router = new koaRouter();

router.post('/:name/:rev', async (ctx: koaRouter.IRouterContext) => {
  const { name, rev } = ctx.params;
  const { transactionId, tags } = ctx.query;
  const workflowDefinition: WorkflowDefinition.IWorkflowDefinition = await workflowDefinitionStore.get(
    name,
    rev,
  );
  if (!workflowDefinition) {
    throw new Error('Workflow not found');
  }
  return transactionInstanceStore.create(
    transactionId || uuid(),
    workflowDefinition,
    ctx.request.body,
    tags ? JSON.parse(tags) : [],
  );
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

router.post('/update', (ctx: koaRouter.IRouterContext) => {
  return processUpdateTasks([ctx.request.body]);
});
