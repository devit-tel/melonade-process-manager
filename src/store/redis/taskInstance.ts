import ioredis from 'ioredis';
import { Task, Event, State } from '@melonade/melonade-declaration';
import { ITaskInstanceStore } from '../../store';
import { RedisStore } from '../redis';
import { prefix } from '../../config';
import * as uuid from 'uuid/v4';

export class TaskInstanceRedisStore extends RedisStore
  implements ITaskInstanceStore {
  constructor(redisOptions: ioredis.RedisOptions) {
    super(redisOptions);
  }

  create = async (taskData: Task.ITask): Promise<Task.ITask> => {
    const task = {
      logs: [],
      ...taskData,
      taskId: uuid(),
    };

    const results = await this.client
      .pipeline()
      .setnx(`${prefix}.task.${task.taskId}`, JSON.stringify(task))
      .sadd(`${prefix}.workflow-task.${task.workflowId}`, task.taskId)
      .exec();

    if (results[0][1] !== 1) {
      // if cannot set recurrsively create
      console.log('recreate');
      return this.create(taskData);
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
      ...taskKeys.map(taskId => `${prefix}.task.${taskId}`),
    );

    return tasksString.map(JSON.parse);
  };

  delete(taskId: string): Promise<any> {
    return this.client.del(`${prefix}.task.${taskId}`);
  }
}
