import koaRouter = require('koa-router');
import { WorkflowDefinition } from '@melonade/melonade-declaration';
import * as uuid from 'uuid/v4';
import { processCancelTransactionCommand } from '../../../../command';
import {
  transactionInstanceStore,
  workflowDefinitionStore,
} from '../../../../store';

export const router = new koaRouter();

router.post('/:name/:rev', async (ctx: koaRouter.IRouterContext & any) => {
  const { name, rev } = ctx.params;
  const { transactionId } = ctx.query;
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
  );
});

router.delete('/cancel/:transactionId', (ctx: koaRouter.IRouterContext) => {
  const { transactionId } = ctx.params;
  return processCancelTransactionCommand(transactionId);
});

router.get('/', (ctx: koaRouter.IRouterContext) => {
  const { from = 0, size = 50 } = ctx.query;
  return transactionInstanceStore.list(+from, +size);
});
