import {
  State,
  Task,
  Workflow,
  WorkflowDefinition,
} from '@melonade/melonade-declaration';
import { poll, sendEvent, systemConsumerClient } from './kafka';
import { getTaskData } from './state';
import {
  taskInstanceStore,
  workflowDefinitionStore,
  workflowInstanceStore,
} from './store';

const processDecisionTask = async (systemTask: Task.ITask) => {
  const workflow = await workflowInstanceStore.get(systemTask.workflowId);
  const taskData = await getTaskData(workflow);

  await taskInstanceStore.create(
    workflow,
    systemTask.decisions[systemTask.input.case]
      ? systemTask.decisions[systemTask.input.case][0]
      : systemTask.defaultDecision[0],
    taskData,
    true,
  );
};

const processParallelTask = async (systemTask: Task.ITask) => {
  const workflow = await workflowInstanceStore.get(systemTask.workflowId);
  const taskData = await getTaskData(workflow);
  await Promise.all(
    systemTask.parallelTasks.map((tasks: WorkflowDefinition.AllTaskType[]) =>
      taskInstanceStore.create(workflow, tasks[0], taskData, true),
    ),
  );
};

const processSubWorkflowTask = async (systemTask: Task.ITask) => {
  const workflowDefinition = await workflowDefinitionStore.get(
    systemTask.workflow.name,
    systemTask.workflow.rev,
  );

  if (!workflowDefinition) {
    sendEvent({
      type: 'SYSTEM',
      transactionId: systemTask.transactionId,
      details: null,
      timestamp: Date.now(),
      isError: true,
      error: `Workflow: "${systemTask.workflow.name}":"${systemTask.workflow.rev}" is not exists`,
    });
    return taskInstanceStore.update({
      transactionId: systemTask.transactionId,
      taskId: systemTask.taskId,
      status: State.TaskStates.Failed,
      isSystem: true,
    });
  }

  return workflowInstanceStore.create(
    systemTask.transactionId,
    Workflow.WorkflowTypes.SubWorkflow,
    workflowDefinition,
    systemTask.input,
    systemTask.taskId,
  );
};

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
          case Task.TaskTypes.Decision:
            await processDecisionTask(task);
            break;
          case Task.TaskTypes.Parallel:
            await processParallelTask(task);
            break;
          case Task.TaskTypes.SubWorkflow:
            await processSubWorkflowTask(task);
            break;
          case Task.TaskTypes.Task:
            // It's not system task
            // I return to prevent it from update the task
            await processActivityTask(task);
            continue;
          default:
            throw new Error(`Task: ${task.type} is not system task`);
        }
        // The only job of system task is dispatch others task, so after they do the job they're completed
        await taskInstanceStore.update({
          isSystem: true,
          taskId: task.taskId,
          transactionId: task.transactionId,
          status: State.TaskStates.Completed,
        });
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
