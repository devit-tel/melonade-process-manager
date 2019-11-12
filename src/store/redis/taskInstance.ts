import { Event, State, Task } from '@melonade/melonade-declaration';
import ioredis from 'ioredis';
import * as uuid from 'uuid/v4';
import { prefix } from '~/config';
import { ITaskInstanceStore } from '~/store';
import { RedisStore } from '~/store/redis';

export class TaskInstanceRedisStore extends RedisStore
  implements ITaskInstanceStore {
  constructor(redisOptions: ioredis.RedisOptions) {
    super(redisOptions);
  }

  create = async (
    taskData: Task.ITask,
    oldTaskId?: string,
  ): Promise<Task.ITask> => {
    const task = {
      logs: [],
      ...taskData,
      taskId: uuid(),
    };
    const pipeline = this.client
      .pipeline()
      .setnx(`${prefix}.task.${task.taskId}`, JSON.stringify(task))
      .sadd(`${prefix}.workflow-task.${task.workflowId}`, task.taskId);

    if (oldTaskId)
      pipeline.srem(`${prefix}.workflow-task.${task.workflowId}`, oldTaskId);

    const results = await pipeline.exec();

    if (results[0][1] !== 1) {
      // if cannot set recurrsively create
      console.log('recreate');
      return this.create(taskData, task.taskId);
    }

    return task;
  };

  update = async (taskUpdate: Event.ITaskUpdate): Promise<Task.ITask> => {
    const key = `${prefix}.task.${taskUpdate.taskId}`;
    const taskString = await this.client.get(key);
    if (!taskString) {
      throw new Error(`Task "${taskUpdate.taskId}" not found`);
    }

    const task = JSON.parse(taskString);
    if (taskUpdate.isSystem) {
      if (
        !State.TaskNextStatesSystem[task.status].includes(taskUpdate.status)
      ) {
        throw new Error(
          `Cannot change status of "${taskUpdate.taskId}" from ${task.status} to ${taskUpdate.status}`,
        );
      }
    } else {
      if (!State.TaskNextStates[task.status].includes(taskUpdate.status)) {
        throw new Error(
          `Cannot change status of "${taskUpdate.taskId}" from ${task.status} to ${taskUpdate.status}`,
        );
      }
    }

    const updatedTask = {
      ...task,
      status: taskUpdate.status,
      output: taskUpdate.output,
      endTime: [
        State.TaskStates.Completed,
        State.TaskStates.Failed,
        State.TaskStates.Timeout,
        State.TaskStates.AckTimeOut,
      ].includes(taskUpdate.status)
        ? Date.now()
        : null,
      logs: taskUpdate.logs
        ? [...(task.logs ? task.logs : []), taskUpdate.logs]
        : task.logs,
    };

    await this.client.set(key, JSON.stringify(updatedTask));

    return updatedTask;
  };

  get = async (taskId: string): Promise<Task.ITask> => {
    const taskString = await this.client.get(`${prefix}.task.${taskId}`);

    if (taskString) return JSON.parse(taskString);
    return null;
  };

  getAll = async (workflowId: string): Promise<Task.ITask[]> => {
    const taskKeys = await this.client.smembers(
      `${prefix}.workflow-task.${workflowId}`,
    );

    const tasksString = await this.client.mget(
      ...taskKeys.map((taskId: string) => `${prefix}.task.${taskId}`),
    );

    return tasksString.map(JSON.parse);
  };

  delete = async (taskId: string): Promise<any> => {
    const task = await this.get(taskId);
    return this.client
      .pipeline()
      .srem(`${prefix}.workflow-task.${task.workflowId}`, taskId)
      .del(`${prefix}.task.${taskId}`)
      .exec();
  };

  deleteAll = async (workflowId: string): Promise<void> => {
    const key = `${prefix}.workflow-task.${workflowId}`;
    const taskKeys = await this.client.smembers(key);
    await this.client.del(
      ...taskKeys.map((taskId: string) => `${prefix}.task.${taskId}`),
      key,
    );
  };
}
