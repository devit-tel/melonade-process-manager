import { TaskDefinition, ITaskDefinition } from '../../../taskDefinition';
import { taskDefinitionStore } from '../../../store';
import { createTopic } from '../../../kafka';

export const createTaskDefinition = async (
  taskDefinitionData: ITaskDefinition,
): Promise<any> => {
  const taskDefinition = new TaskDefinition(taskDefinitionData);
  await taskDefinitionStore.create(taskDefinition.toObject());
  await createTopic(taskDefinition.name);
  return taskDefinition.toObject();
};

export const updateTaskDefinition = async (
  taskDefinitionData: ITaskDefinition,
): Promise<any> => {
  const taskDefinition = new TaskDefinition(taskDefinitionData);
  await taskDefinitionStore.update(taskDefinition.toObject());
};

export const getTaskDefinition = (
  taskName: string,
): Promise<ITaskDefinition> => {
  return taskDefinitionStore.get(taskName);
};

export const listTaskDefinition = (): Promise<ITaskDefinition[]> => {
  return taskDefinitionStore.list();
};
