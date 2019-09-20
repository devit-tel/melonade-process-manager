import koaRouter = require('koa-router');

export const router = new koaRouter();

router.get('/health', () => {
  // TODO add reak health check
  return {
    status: 'OK'
  }
});
