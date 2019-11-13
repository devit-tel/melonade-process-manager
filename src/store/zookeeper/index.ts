import * as nodeZookeeperClient from 'node-zookeeper-client';
import * as R from 'ramda';
import { IStore } from '..';
import { enumToList } from '../../utils/common';

export class ZookeeperStore implements IStore {
  localStore: any = {};
  root: string = '/';
  client: nodeZookeeperClient.Client;

  constructor(
    root: string,
    connectionString: string,
    options?: nodeZookeeperClient.Option,
  ) {
    this.root = root;
    this.client = nodeZookeeperClient.createClient(connectionString, options);
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
        (error: Error) => {
          if (error) return reject(error);
          resolve();
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
