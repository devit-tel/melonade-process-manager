import koaRouter = require('koa-router');
import { TaskDefinition } from '@melonade/melonade-declaration';
import { createTaskTopic } from '../../../../kafka';
import { taskDefinitionStore } from '../../../../store';

export const router = new koaRouter();

router.post('/', async (ctx: koaRouter.IRouterContext | any) => {
  const taskDefinition = new TaskDefinition.TaskDefinition(ctx.request.body);
  await taskDefinitionStore.create(taskDefinition);
  await createTaskTopic(taskDefinition.name);
  return taskDefinition;
});

router.put('/', (ctx: koaRouter.IRouterContext | any) => {
  return taskDefinitionStore.update(
    new TaskDefinition.TaskDefinition(ctx.request.body),
  );
});

router.get('/:name', (ctx: koaRouter.IRouterContext) => {
  const { name } = ctx.params;
  return taskDefinitionStore.get(name);
});

router.get('/', () => {
  return taskDefinitionStore.list();
});
