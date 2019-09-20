import nodeZookeeperClient = require('node-zookeeper-client');
import * as R from 'ramda';
import { IStore } from '../../store';
import { enumToList } from '../../utils/common';

export interface IZookeeperOptions {
  sessionTimeout: number;
  spinDelay: number;
  retries: number;
}

export enum ZookeeperEvents {
  NODE_CREATED = 'NODE_CREATED',
  NODE_DELETED = 'NODE_DELETED',
  NODE_DATA_CHANGED = 'NODE_DATA_CHANGED',
  NODE_CHILDREN_CHANGED = 'NODE_CHILDREN_CHANGED',
}

export interface IZookeeperEvent {
  type: number;
  name: ZookeeperEvents;
  path: string;
}

export class ZookeeperStore implements IStore {
  localStore: any = {};
  root: string = '/';
  client: any;

  constructor(
    root: string,
    connectionString: string,
    options?: IZookeeperOptions,
  ) {
    this.root = root;
    this.client = new nodeZookeeperClient.createClient(
      connectionString,
      options,
    );
    this.client.connect();
  }

  isHealthy(): boolean {
    return ['SYNC_CONNECTED', 'CONNECTED', 'CONNECTED_READ_ONLY'].includes(
      this.client.getState().name,
    );
  }

  isExists(path: string): Promise<boolean> {
    return new Promise((resolve: Function, reject: Function) => {
      this.client.exists(path, (error: Error, stat: any) => {
        if (error) return reject(error);

        if (stat) return resolve(true);
        resolve(false);
      });
    });
  }

  setValue(key: string, value: any = ''): Promise<any> | any {
    return new Promise((resolve: Function, reject: Function) => {
      // This can make sure it's never overwrite old data
      this.client.setData(
        `${this.root}/${key.replace(/\./, '/')}`,
        Buffer.from(value),
        null,
        (error: Error, path: string) => {
          if (error) return reject(error);
          resolve(path);
        },
      );
    });
  }

  getValue(key: string): any {
    return R.path(key.split('.'), this.localStore);
  }

  unsetValue(key: string): any {
    return new Promise((resolve: Function, reject: Function) => {
      this.client.remove(
        `${this.root}/${key.replace(/\./, '/')}`,
        -1,
        (error: Error) => {
          if (error) return reject(error);
          resolve();
        },
      );
    });
  }

  listValue(
    limit: number = Number.MAX_SAFE_INTEGER,
    offset: number = 0,
  ): any[] {
    return R.slice(offset, limit, enumToList(this.localStore));
  }
}
