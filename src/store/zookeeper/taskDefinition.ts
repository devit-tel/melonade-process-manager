// Serializer for 1 layer node (${root}/${taskName})
import * as nodeZookeeperClient from 'node-zookeeper-client';
import * as R from 'ramda';
import { TaskDefinition } from '@melonade/melonade-declaration';
import { ZookeeperStore } from '../zookeeper';
import { jsonTryParse } from '../../utils/common';
import { ITaskDefinitionStore } from '..';

// This is wrong
export class TaskDefinitionZookeeperStore extends ZookeeperStore
  implements ITaskDefinitionStore {
  constructor(
    root: string,
    connectionString: string,
    options?: nodeZookeeperClient.Option,
  ) {
    super(root, connectionString, options);

    this.client.mkdirp(
      this.root,
      null,
      null,
      nodeZookeeperClient.CreateMode.PERSISTENT,
      (error: Error) => {
        if (!error) {
          this.getAndWatchTasks();
        }
      },
    );
  }

  get(name: string): Promise<TaskDefinition.ITaskDefinition> {
    return this.localStore[name];
  }

  create = async (
    taskDefinition: TaskDefinition.ITaskDefinition,
  ): Promise<TaskDefinition.ITaskDefinition> => {
    const isTaskExists = await this.isExists(
      `${this.root}/${taskDefinition.name}`,
    );

    if (isTaskExists)
      throw new Error(`Task: ${taskDefinition.name} already exists`);

    return new Promise((resolve: Function, reject: Function) =>
      this.client.create(
        `${this.root}/${taskDefinition.name}`,
        Buffer.from(JSON.stringify(taskDefinition)),
        nodeZookeeperClient.CreateMode.PERSISTENT,
        (error: Error) => {
          if (error) return reject(error);
          resolve(taskDefinition);
        },
      ),
    );
  };

  update(
    taskDefinition: TaskDefinition.ITaskDefinition,
  ): Promise<TaskDefinition.ITaskDefinition> {
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

  list(): Promise<TaskDefinition.ITaskDefinition[]> {
    return Promise.resolve(this.listValue(undefined, 0));
  }

  getAndWatchTasks = () => {
    this.client.getChildren(
      this.root,
      (event: nodeZookeeperClient.Event) => {
        switch (event.type) {
          case nodeZookeeperClient.Event.NODE_CHILDREN_CHANGED:
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
      (event: nodeZookeeperClient.Event) => {
        switch (event.type) {
          case nodeZookeeperClient.Event.NODE_DATA_CHANGED:
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
            this.localStore[task] = new TaskDefinition.TaskDefinition(
              jsonTryParse(data.toString()),
            );
          } catch (error) {
            console.error(error);
          }
        }
      },
    );
  };
}
