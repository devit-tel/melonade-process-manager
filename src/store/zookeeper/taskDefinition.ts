// Serializer for 1 layer node (${root}/${taskName})
import * as R from 'ramda';
import {
  ZookeeperStore,
  IZookeeperOptions,
  IZookeeperEvent,
  ZookeeperEvents,
} from '.';
import { TaskDefinition, ITaskDefinition } from '../../taskDefinition';
import { jsonTryParse } from '../../utils/common';
import { ITaskDefinitionStore } from '..';
import { BadRequest } from '../../errors';

// This is wrong
export class TaskDefinitionZookeeperStore extends ZookeeperStore
  implements ITaskDefinitionStore {
  constructor(
    root: string,
    connectionString: string,
    options?: IZookeeperOptions,
  ) {
    super(root, connectionString, options);

    this.client.mkdirp(this.root, null, null, null, (error: Error) => {
      if (!error) {
        this.getAndWatchTasks();
      }
    });
  }

  get(name: string): Promise<ITaskDefinition> {
    return this.localStore[name];
  }

  create = async (
    taskDefinition: ITaskDefinition,
  ): Promise<ITaskDefinition> => {
    const isWorkflowExists = await this.isExists(
      `${this.root}/${taskDefinition.name}`,
    );

    if (isWorkflowExists)
      throw new BadRequest(`Workflow: ${taskDefinition.name} already exists`);

    return new Promise((resolve: Function, reject: Function) =>
      this.client.create(
        `${this.root}/${taskDefinition.name}`,
        Buffer.from(JSON.stringify(taskDefinition)),
        'PERSISTENT',
        (error: Error) => {
          if (error) return reject(error);
          resolve(taskDefinition);
        },
      ),
    );
  };

  update(taskDefinition: ITaskDefinition): Promise<ITaskDefinition> {
    return new Promise((resolve: Function, reject: Function) =>
      this.client.setData(
        `${this.root}/${taskDefinition.name}`,
        Buffer.from(JSON.stringify(taskDefinition)),
        -1,
        (error: Error) => {
          if (error) return reject(error);
          resolve(taskDefinition);
        },
      ),
    );
  }

  list(): Promise<ITaskDefinition[]> {
    return Promise.resolve(this.listValue(undefined, 0));
  }

  getAndWatchTasks = () => {
    this.client.getChildren(
      this.root,
      (event: IZookeeperEvent) => {
        switch (event.name) {
          case ZookeeperEvents.NODE_CHILDREN_CHANGED:
            // When created new task, this is also fired when task are deleted, but did not handled at this time
            this.getAndWatchTasks();
            break;
          default:
            break;
        }
        return true;
      },
      (tasksError: Error, tasks: string[]) => {
        if (!tasksError) {
          for (const task of tasks) {
            if (R.isNil(this.localStore.rav)) {
              this.getAndWatchTask(task);
            }
          }
        }
      },
    );
  };

  getAndWatchTask = (task: string) => {
    this.client.getData(
      `${this.root}/${task}`,
      (event: IZookeeperEvent) => {
        switch (event.name) {
          case ZookeeperEvents.NODE_DATA_CHANGED:
            // When task's data change
            this.getAndWatchTask(task);
            break;
          default:
            break;
        }
        return true;
      },
      (dataError: Error, data: Buffer) => {
        if (!dataError) {
          try {
            const taskDefinition = new TaskDefinition(
              jsonTryParse(data.toString()),
            );
            this.localStore[task] = taskDefinition.toObject();
          } catch (error) {
            console.error(error);
          }
        }
      },
    );
  };
}
