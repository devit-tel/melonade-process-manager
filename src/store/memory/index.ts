import * as R from 'ramda';
import { IStore } from '..';
import { enumToList } from '../../utils/common';

export class MemoryStore implements IStore {
  localStore: any = {};

  constructor() {}

  isHealthy(): boolean {
    return true;
  }

  setValue(key: string, value: any) {
    this.localStore[key] = value;
    // this.localStore = R.set(R.lensPath(key.split('.')), value, this.localStore);
  }

  unsetValue(key: string): any {
    // this.localStore = R.dissocPath(key.split('.'), this.localStore);
    delete this.localStore[key];
  }

  getValue(key: string): any {
    return R.path(key.split('.'), this.localStore);
  }

  listValue(
    limit: number = Number.MAX_SAFE_INTEGER,
    offset: number = 0,
  ): any[] {
    return R.slice(offset, limit, enumToList(this.localStore));
  }
}
