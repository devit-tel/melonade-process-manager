import koaRouter = require('koa-router');
import { isHealthy as isKafkaHealthy } from '../../../kafka';
import { isHealthy as isStoreHealthy } from '../../../store';

export const router = new koaRouter();

router.get('/health', () => {
  const isKafkaReady = isKafkaHealthy();
  const isStoreReady = isStoreHealthy();
  if (isKafkaReady && isStoreReady) {
    return {
      isKafkaReady,
      isStoreReady,
    };
  }
  throw new Error(
    JSON.stringify({
      isKafkaReady,
      isStoreReady,
    }),
  );
});
