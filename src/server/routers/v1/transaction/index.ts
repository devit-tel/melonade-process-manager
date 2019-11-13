import koaRouter = require('koa-router');
import { WorkflowDefinition } from '@melonade/melonade-declaration';
import * as uuid from 'uuid/v4';
import { transactionInstanceStore, workflowDefinitionStore } from '../../../../store';

export const router = new koaRouter();

router.post('/:name/:rev', async (ctx: koaRouter.IRouterContext | any) => {
  const { name, rev, transactionId } = ctx.params;
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
