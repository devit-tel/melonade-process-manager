import { TaskDefinition } from '@melonade/melonade-declaration';
import { createTopic } from '../../../kafka';
import { taskDefinitionStore } from '../../../store';

export const createTaskDefinition = async (
  taskDefinitionData: TaskDefinition.ITaskDefinition,
): Promise<any> => {
  const taskDefinition = new TaskDefinition.TaskDefinition(taskDefinitionData);
  await taskDefinitionStore.create(taskDefinition);
  await createTopic(taskDefinition.name);
  return taskDefinition;
};

export const updateTaskDefinition = (
  taskDefinitionData: TaskDefinition.ITaskDefinition,
): Promise<any> => {
  return taskDefinitionStore.update(
    new TaskDefinition.TaskDefinition(taskDefinitionData),
  );
};

export const getTaskDefinition = (
  taskName: string,
): Promise<TaskDefinition.ITaskDefinition> => {
  return taskDefinitionStore.get(taskName);
};

export const listTaskDefinition = (): Promise<
  TaskDefinition.ITaskDefinition[]
> => {
  return taskDefinitionStore.list();
};
