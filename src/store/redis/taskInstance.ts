import { Event, State, Task } from '@melonade/melonade-declaration';
import ioredis from 'ioredis';
import * as uuid from 'uuid/v4';
import { RedisStore } from '.';
import { ITaskInstanceStore, transactionInstanceStore } from '..';
import { prefix } from '../../config';
import { appendArray } from '../../utils/common';

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

    const task: Task.ITask = JSON.parse(taskString);
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
      logs: appendArray(taskUpdate.logs ?? [], taskUpdate.logs),
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

    return tasksString.map((t) => JSON.parse(t));
  };

  delete = async (
    taskId: string,
    keepSubTransaction?: boolean,
  ): Promise<void> => {
    const task = await this.get(taskId);

    if (!keepSubTransaction && task.type === Task.TaskTypes.SubTransaction) {
      await transactionInstanceStore.delete(
        `${task.transactionId}-${task.taskReferenceName}`,
      );
    }

    await this.client
      .pipeline()
      .srem(`${prefix}.workflow-task.${task.workflowId}`, taskId)
      .del(`${prefix}.task.${taskId}`)
      .exec();
  };

  deleteAll = async (
    workflowId: string,
    keepSubTransaction?: boolean,
  ): Promise<void> => {
    const key = `${prefix}.workflow-task.${workflowId}`;
    const tasks = await this.getAll(workflowId);

    await Promise.all([
      this.client.del(
        ...tasks.map((task: Task.ITask) => `${prefix}.task.${task.taskId}`),
        key,
      ) as Promise<any>,
      ...tasks
        .filter(
          (task: Task.ITask) =>
            !keepSubTransaction && task.type === Task.TaskTypes.SubTransaction,
        )
        .map((task: Task.ITask) =>
          transactionInstanceStore.delete(
            `${task.transactionId}-${task.taskReferenceName}`,
          ),
        ),
    ]);
  };
}
