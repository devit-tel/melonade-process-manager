import koaRouter = require('koa-router');
import { WorkflowDefinition } from '@melonade/melonade-declaration';
import { workflowDefinitionStore } from '../../../../store';

export const router = new koaRouter();

router.post('/', (ctx: koaRouter.IRouterContext | any) => {
  return workflowDefinitionStore.create(
    new WorkflowDefinition.WorkflowDefinition(ctx.request.body),
  );
});

router.get('/:name/:rev', (ctx: koaRouter.IRouterContext) => {
  const { name, rev } = ctx.params;
  return workflowDefinitionStore.get(name, rev);
});

router.delete('/:name/:rev', (ctx: koaRouter.IRouterContext) => {
  const { name, rev } = ctx.params;
  return workflowDefinitionStore.delete(name, rev);
});

router.put('/', (ctx: koaRouter.IRouterContext | any) => {
  return workflowDefinitionStore.update(
    new WorkflowDefinition.WorkflowDefinition(ctx.request.body),
  );
});

router.get('/', () => {
  return workflowDefinitionStore.list();
});
