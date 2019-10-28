import { TaskDefinition } from '@melonade/melonade-declaration';
import { ITaskDefinitionStore } from '..';
import { MemoryStore } from '../memory';

// This is wrong
export class TaskDefinitionMemoryStore extends MemoryStore
  implements ITaskDefinitionStore {
  constructor() {
    super();
  }

  get(name: string): Promise<TaskDefinition.ITaskDefinition> {
    return Promise.resolve(this.localStore[name]);
  }

  create = async (
    taskDefinition: TaskDefinition.ITaskDefinition,
  ): Promise<TaskDefinition.ITaskDefinition> => {
    const isTaskExists = this.localStore[taskDefinition.name];

    if (isTaskExists)
      throw new Error(`Task: ${taskDefinition.name} already exists`);

    this.localStore[taskDefinition.name] = taskDefinition;

    return taskDefinition;
  };

  update(
    taskDefinition: TaskDefinition.ITaskDefinition,
  ): Promise<TaskDefinition.ITaskDefinition> {
    this.localStore[taskDefinition.name] = taskDefinition;
    return Promise.resolve(taskDefinition);
  }

  list(): Promise<{ [name: string]: TaskDefinition.ITaskDefinition }> {
    return Promise.resolve(this.localStore);
  }
}
