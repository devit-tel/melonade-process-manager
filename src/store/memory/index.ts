import * as R from 'ramda';
import { IStore } from '..';

export class MemoryStore implements IStore {
  localStore: { [key: string]: any } = {};

  constructor() {}

  isHealthy(): boolean {
    return true;
  }

  setValue(key: string, value: any) {
    this.localStore[key] = value;
    return value;
  }

  unsetValue(key: string) {
    delete this.localStore[key];
    return null;
  }

  getValue(key: string): any {
    return this.localStore[key] || null;
  }

  listValue(limit: number = Number.MAX_SAFE_INTEGER, offset: number = 0): any {
    return R.slice(offset, limit, R.values(this.localStore));
  }
}
