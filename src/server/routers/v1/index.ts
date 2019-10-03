import koaRouter = require('koa-router');
import * as transactionRouter from './transaction';
import * as definitionRouter from './definition';

export const router = new koaRouter();

router.use(
  '/transaction',
  transactionRouter.router.routes(),
  transactionRouter.router.allowedMethods(),
);

router.use(
  '/definition',
  definitionRouter.router.routes(),
  definitionRouter.router.allowedMethods(),
);
