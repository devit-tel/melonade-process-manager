import { Event, State, Task } from '@melonade/melonade-declaration';
import * as uuid from 'uuid/v4';
import { ITaskInstanceStore } from '../../store';
import { MemoryStore } from '../memory';

export class TaskInstanceMemoryStore extends MemoryStore
  implements ITaskInstanceStore {
  constructor() {
    super();
  }

  create = async (taskData: Task.ITask): Promise<Task.ITask> => {
    const task = {
      logs: [],
      ...taskData,
      taskId: uuid(),
    };

    this.setValue(task.taskId, task);

    return task;
  };

  update = async (taskUpdate: Event.ITaskUpdate): Promise<Task.ITask> => {
    const task = this.getValue(taskUpdate.taskId);
    if (!task) {
      throw new Error(`Task "${taskUpdate.taskId}" not found`);
    }

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

    this.setValue(taskUpdate.taskId, updatedTask);

    return updatedTask;
  };

  get = async (taskId: string): Promise<Task.ITask> => {
    return this.getValue(taskId);
  };

  getAll = async (workflowId: string): Promise<Task.ITask[]> => {
    return this.listValue().filter(
      (task: Task.ITask) => task.workflowId === workflowId,
    );
  };

  delete = async (taskId: string): Promise<any> => {
    return this.unsetValue(taskId);
  };

  deleteAll = async (workflowId: string): Promise<void> => {
    const workflowTasks = await this.getAll(workflowId);
    for (const task of workflowTasks) {
      this.unsetValue(task.taskId);
    }
  };
}
