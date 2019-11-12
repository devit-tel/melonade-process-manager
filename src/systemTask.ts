import { Task } from '@melonade/melonade-declaration';
import { poll, sendEvent, systemConsumerClient } from '~/kafka';
import { taskInstanceStore } from '~/store';

const processActivityTask = (task: Task.ITask) => {
  return taskInstanceStore.reload({
    ...task,
    retries: task.retries - 1,
    isRetried: true,
  });
};

export const processSystemTasks = async (
  tasks: Task.ITask[],
): Promise<void> => {
  if (tasks.length) {
    for (const task of tasks) {
      try {
        switch (task.type) {
          case Task.TaskTypes.Task:
            // It's not system task
            // I return to prevent it from update the task
            await processActivityTask(task);
            continue;
          default:
            throw new Error(`Task: ${task.type} is not system task`);
        }
      } catch (error) {
        sendEvent({
          type: 'SYSTEM',
          transactionId: task.transactionId,
          timestamp: Date.now(),
          details: task,
          isError: true,
          error: error.toString(),
        });
      }
    }
    systemConsumerClient.commit();
  }
};

export const executor = async () => {
  try {
    const tasks: Task.ITask[] = await poll(systemConsumerClient);
    await processSystemTasks(tasks);
  } catch (error) {
    // Handle error here
    console.log(error);
  }
  setImmediate(executor);
};
