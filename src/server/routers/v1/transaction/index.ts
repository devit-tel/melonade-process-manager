import koaRouter = require('koa-router');
import { startTransaction } from '../../../../domains/transaction';

export const router = new koaRouter();

router.post('/:name/:rev', (ctx: koaRouter.IRouterContext | any) => {
  const { name, rev } = ctx.params;
  return startTransaction(name, rev, ctx.request.body);
});
