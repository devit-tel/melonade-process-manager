import koaRouter = require('koa-router');
import {
  createWorkflowDefinition,
  getWorkflowDefinition,
  listWorkflowDefinition,
  updateWorkflowDefinition,
} from '../../../../domains/definitions/workflow';

export const router = new koaRouter();

router.post('/', (ctx: koaRouter.IRouterContext | any) => {
  return createWorkflowDefinition(ctx.request.body);
});

router.get('/:name/:rev', (ctx: koaRouter.IRouterContext) => {
  const { name, rev } = ctx.params;
  return getWorkflowDefinition(name, rev);
});

router.get('/', () => {
  return listWorkflowDefinition();
});

router.put('/', (ctx: koaRouter.IRouterContext | any) => {
  return updateWorkflowDefinition(ctx.request.body);
});
