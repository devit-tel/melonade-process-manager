import ioredis from 'ioredis';
import * as redisLock from 'ioredis-lock';
import { IDistributedLockInstance, IDistributedLockStore } from '..';

export class DistributedLockRedisStore implements IDistributedLockStore {
  private client: ioredis.Redis;
  private namespace: string;
  private connected: boolean = false;

  constructor(redisOptions: ioredis.RedisOptions, namespace: string) {
    this.client = this.client = new ioredis(redisOptions);
    this.namespace = namespace;

    this.client
      .on('connect', () => {
        this.connected = true;
      })
      .on('close', () => {
        this.connected = false;
      });
  }

  async lock(transactionId: string): Promise<IDistributedLockInstance> {
    const locker = redisLock.createLock(this.client, {
      timeout: 10000,
      retries: 15,
      delay: 500,
    });
    await locker.acquire(`LOCK:${this.namespace}:${transactionId}`);
    return new DistributedLockRedisInstance(locker);
  }

  isHealthy(): boolean {
    return this.connected;
  }
}

export class DistributedLockRedisInstance implements IDistributedLockInstance {
  private locker: redisLock.Lock;

  constructor(locker: redisLock.Lock) {
    this.locker = locker;
  }

  unlock(): Promise<void> {
    return this.locker.release();
  }
}
