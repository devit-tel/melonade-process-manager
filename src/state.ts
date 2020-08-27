import {
  Event,
  State,
  Task,
  Workflow,
  WorkflowDefinition,
} from '@melonade/melonade-declaration';
import debug from 'debug';
import * as R from 'ramda';
import { poll, sendEvent, stateConsumerClient } from './kafka';
import {
  taskInstanceStore,
  transactionInstanceStore,
  workflowInstanceStore,
} from './store';
import { sleep } from './utils/common';
import { mapParametersToValue } from './utils/task';

const dg = debug('melonade:state');

export const isAllTasksFinished = R.all((task?: Task.ITask) =>
  [
    State.TaskStates.Completed,
    State.TaskStates.Failed,
    State.TaskStates.AckTimeOut,
    State.TaskStates.Timeout,
  ].includes(task?.status),
);

export const isAnyTasksFailed = R.any((task?: Task.ITask) =>
  [
    State.TaskStates.Failed,
    State.TaskStates.Timeout,
    State.TaskStates.AckTimeOut,
  ].includes(task?.status),
);

export const getNextPath = (
  currentPath: (string | number)[],
): (string | number)[] => [...R.init(currentPath), +R.last(currentPath) + 1];

export const isChildOfDecisionDefault = (
  tasks: WorkflowDefinition.AllTaskType[],
  currentPath: (string | number)[],
): boolean =>
  R.pathEq(
    [...R.dropLast(2, currentPath), 'type'],
    Task.TaskTypes.Decision,
    tasks,
  ) && R.nth(-2, currentPath) === 'defaultDecision';

export const isChildOfDecisionCase = (
  tasks: WorkflowDefinition.AllTaskType[],
  currentPath: (string | number)[],
): boolean =>
  R.pathEq(
    [...R.dropLast(3, currentPath), 'type'],
    Task.TaskTypes.Decision,
    tasks,
  ) && R.nth(-3, currentPath) === 'decisions';

const isChildOfParallelTask = (
  tasks: WorkflowDefinition.AllTaskType[],
  currentPath: (string | number)[],
): boolean =>
  R.pathEq(
    [...R.dropLast(3, currentPath), 'type'],
    Task.TaskTypes.Parallel,
    tasks,
  );

export const isChildOfDynamicTask = (
  tasks: WorkflowDefinition.AllTaskType[],
  currentPath: (string | number)[],
): boolean =>
  R.pathEq(
    [...R.dropLast(2, currentPath), 'type'],
    Task.TaskTypes.DynamicTask,
    tasks,
  );

const getNextParallelTask = (
  tasks: WorkflowDefinition.AllTaskType[],
  currentPath: (string | number)[],
  taskData: { [taskReferenceName: string]: Task.ITask },
): {
  isCompleted: boolean;
  taskPath: (string | number)[];
  parentTask: Task.ITask;
  isLastChild: boolean;
} => {
  const taskReferenceName: string = R.path(
    [...R.dropLast<string | number>(3, currentPath), 'taskReferenceName'],
    tasks,
  );
  const parentTask = taskData[taskReferenceName];

  const lastTaskOfEachLine = R.pathOr<WorkflowDefinition.AllTaskType[][]>(
    [],
    R.dropLast(2, currentPath),
    tasks,
  ).map((pTask: WorkflowDefinition.AllTaskType[]) => {
    let lastFoundTask: Task.ITask;
    for (const task of pTask) {
      if (taskData[task.taskReferenceName]) {
        lastFoundTask = taskData[task.taskReferenceName];
      } else {
        return lastFoundTask;
      }
    }
    return lastFoundTask;
  });

  // Check if no any INLINE failed tasks AND still get next task in line
  if (
    !isAnyTasksFailed(lastTaskOfEachLine) &&
    R.path(getNextPath(currentPath), tasks)
  ) {
    return {
      isCompleted: false,
      taskPath: getNextPath(currentPath),
      parentTask,
      isLastChild: false,
    };
  }

  // All of lines are completed
  // If no next task, so this mean this parellel task will completed aswell
  if (isAllTasksFinished(lastTaskOfEachLine)) {
    return {
      isCompleted: false,
      taskPath: null,
      parentTask,
      isLastChild: true,
    };
  }

  // Wait for other line
  return {
    isCompleted: false,
    taskPath: null,
    parentTask,
    isLastChild: false,
  };
};

const getNextDecisionTask = (
  tasks: WorkflowDefinition.AllTaskType[],
  currentPath: (string | number)[],
  taskData: { [taskReferenceName: string]: Task.ITask },
): {
  isCompleted: boolean;
  taskPath: (string | number)[];
  parentTask: Task.ITask;
  isLastChild: boolean;
} => {
  const childOfDecisionDefault = isChildOfDecisionDefault(tasks, currentPath);
  const decisionTaskPath = childOfDecisionDefault
    ? R.dropLast(2, currentPath)
    : R.dropLast(3, currentPath);

  const taskReferenceName: string = R.path(
    [...decisionTaskPath, 'taskReferenceName'],
    tasks,
  );

  const childTasks = R.pathOr<WorkflowDefinition.AllTaskType[]>(
    [],
    R.dropLast(1, currentPath),
    tasks,
  );

  let lastFoundTask: Task.ITask;
  for (const task of childTasks) {
    if (taskData[task.taskReferenceName]) {
      lastFoundTask = taskData[task.taskReferenceName];
    }
  }

  // If there are next child
  // Check if no any INLINE failed tasks AND still get next task in line
  if (
    !isAnyTasksFailed([lastFoundTask]) &&
    R.path(getNextPath(currentPath), tasks)
  ) {
    return {
      isCompleted: false,
      taskPath: getNextPath(currentPath),
      parentTask: taskData[taskReferenceName],
      isLastChild: false,
    };
  }

  // If no next task, so this mean this desision task will completed aswell
  return {
    isCompleted: false,
    taskPath: null,
    parentTask: taskData[taskReferenceName],
    isLastChild: true,
  };
};

const getNextDynamicTask = (
  tasks: WorkflowDefinition.AllTaskType[],
  currentPath: (string | number)[],
  taskData: { [taskReferenceName: string]: Task.ITask },
): {
  isCompleted: boolean;
  taskPath: (string | number)[];
  parentTask: Task.ITask;
  isLastChild: boolean;
} => {
  const taskReferenceName: string = R.path(
    [...R.dropLast<string | number>(2, currentPath), 'taskReferenceName'],
    tasks,
  );

  const childTasks = R.pathOr<WorkflowDefinition.AllTaskType[]>(
    [],
    R.dropLast(1, currentPath),
    tasks,
  );

  let lastFoundTask: Task.ITask;
  for (const task of childTasks) {
    if (taskData[task.taskReferenceName]) {
      lastFoundTask = taskData[task.taskReferenceName];
    }
  }

  // If it's have next task and no any child task failed
  if (
    !isAnyTasksFailed([lastFoundTask]) &&
    R.path(getNextPath(currentPath), tasks)
  ) {
    return {
      isCompleted: false,
      taskPath: getNextPath(currentPath),
      parentTask: taskData[taskReferenceName],
      isLastChild: false,
    };
  }

  // No next task
  return {
    isCompleted: false,
    taskPath: null,
    parentTask: taskData[taskReferenceName],
    isLastChild: true,
  };
};

// Check if it's system task\
// isCompleted: is workflow completed
// taskPath: path of next task to exec
// parentTask: parent task
// isLastChild: current task is the last one of this parent
export const getNextTaskPath = (
  tasks: WorkflowDefinition.AllTaskType[],
  currentPath: (string | number)[],
  taskData: { [taskReferenceName: string]: Task.ITask },
): {
  isCompleted: boolean;
  taskPath: (string | number)[];
  parentTask: Task.ITask;
  isLastChild: boolean;
} => {
  // If this is last task of workflow
  if (R.equals([tasks.length - 1], currentPath))
    return {
      isCompleted: true,
      taskPath: null,
      parentTask: null,
      isLastChild: true,
    };

  // Case of current task is parallel's child
  if (isChildOfParallelTask(tasks, currentPath))
    return getNextParallelTask(tasks, currentPath, taskData);

  // Case of current task is decision's child
  if (
    isChildOfDecisionDefault(tasks, currentPath) ||
    isChildOfDecisionCase(tasks, currentPath)
  ) {
    return getNextDecisionTask(tasks, currentPath, taskData);
  }

  // Case of current task is dynamic's child
  if (isChildOfDynamicTask(tasks, currentPath))
    return getNextDynamicTask(tasks, currentPath, taskData);

  // Otherwise get go to next task (last index + 1)
  return {
    isCompleted: false,
    taskPath: getNextPath(currentPath),
    parentTask: null,
    isLastChild: false,
  };
};

export const getTaskData = async (
  workflow: Workflow.IWorkflow,
): Promise<{ [taskReferenceName: string]: Task.ITask }> => {
  const tasks = await taskInstanceStore.getAll(workflow.workflowId);
  return tasks.reduce(
    (result: { [ref: string]: Task.ITask }, task: Task.ITask) => {
      result[task.taskReferenceName] = task;
      return result;
    },
    {},
  );
};

const getTaskInfo = async (task: Task.ITask) => {
  const workflow: Workflow.IWorkflow = await workflowInstanceStore.get(
    task.workflowId,
  );

  const tasksData = await getTaskData(workflow);
  const currentTaskPath = task.taskPath;
  const nextTaskPath = getNextTaskPath(
    workflow.workflowDefinition.tasks,
    currentTaskPath,
    tasksData,
  );

  return {
    workflow,
    tasksData,
    currentTaskPath,
    nextTaskPath,
  };
};

const handleCompletedWorkflow = async (workflow: Workflow.IWorkflow) =>
  transactionInstanceStore.update({
    transactionId: workflow.transactionId,
    status: State.TransactionStates.Completed,
    output: workflow.output,
  });

const handleCompletedCompensateWorkflow = async (
  workflow: Workflow.IWorkflow,
) =>
  transactionInstanceStore.update({
    transactionId: workflow.transactionId,
    status: State.TransactionStates.Compensated,
  });

const handleCompletedCancelWorkflow = async (workflow: Workflow.IWorkflow) =>
  transactionInstanceStore.update({
    transactionId: workflow.transactionId,
    status: State.TransactionStates.Cancelled,
  });

const handleCompletedCompensateThenRetryWorkflow = async (
  workflow: Workflow.IWorkflow,
) => {
  if (workflow.retries > 0) {
    const transaction = await transactionInstanceStore.get(
      workflow.transactionId,
    );
    await workflowInstanceStore.create(
      workflow.transactionId,
      Workflow.WorkflowTypes.Workflow,
      transaction.workflowDefinition,
      transaction.input,
      {
        retries: workflow.retries - 1,
        transactionDepth: transaction.parent?.depth || 0,
      },
    );
  } else {
    await handleCompletedCompensateWorkflow(workflow);
  }
};

const handleCancelWorkflow = async (
  workflow: Workflow.IWorkflow,
  tasksData: { [taskReferenceName: string]: Task.ITask },
) => {
  const tasksDataList = R.values(tasksData);
  const runningTasks = tasksDataList.filter((taskData: Task.ITask) => {
    return [State.TaskStates.Inprogress, State.TaskStates.Scheduled].includes(
      taskData.status,
    );
  });

  // No running task, start recovery
  // If there are running task wait for them first
  if (runningTasks.length === 0) {
    switch (workflow.workflowDefinition.failureStrategy) {
      case State.WorkflowFailureStrategies.Compensate:
      case State.WorkflowFailureStrategies.CompensateThenRetry:
        await handleCompensateWorkflow(workflow, true);
        break;
      case State.WorkflowFailureStrategies.Retry:
      case State.WorkflowFailureStrategies.Failed:
        await handleCompletedCancelWorkflow(workflow);
        break;
      default:
        break;
    }
  }
};

const handleCompletedTask = async (task: Task.ITask): Promise<void> => {
  const { workflow, tasksData, nextTaskPath } = await getTaskInfo(task);
  // If workflow has cancelled
  if (workflow.status === State.WorkflowStates.Cancelled) {
    if (nextTaskPath.parentTask) {
      await processUpdateTask({
        taskId: nextTaskPath.parentTask.taskId,
        transactionId: nextTaskPath.parentTask.transactionId,
        status: State.TaskStates.Completed,
        isSystem: true,
      });
    } else {
      await handleCancelWorkflow(workflow, tasksData);
    }
    return;
  }

  const tasksDataList = R.values(tasksData);
  const failedTasks = tasksDataList.filter((task: Task.ITask) =>
    [
      State.TaskStates.Failed,
      State.TaskStates.AckTimeOut,
      State.TaskStates.Timeout,
    ].includes(task.status),
  );
  // If any task in workflow failed, mean this workflow is going to failed
  // Don't dispatch another task, and wait for all task to finish then do Workflow Failure Strategy
  if (failedTasks.length) {
    // If it have parent so make their parent failed aswell, parent of parent... so on
    if (nextTaskPath.isLastChild && nextTaskPath.parentTask) {
      await processUpdateTask({
        taskId: nextTaskPath.parentTask.taskId,
        transactionId: nextTaskPath.parentTask.transactionId,
        status: State.TaskStates.Failed,
        isSystem: true,
      });
    } else {
      await handleWorkflowFailureStrategy(failedTasks[0], tasksDataList);
    }
    return;
  }

  // For all childs of parallel/decision task has completed => update parent to completed aswell
  // This will cause chain reaction to parent of parent so on...
  if (nextTaskPath.isLastChild && nextTaskPath.parentTask) {
    await processUpdateTask({
      taskId: nextTaskPath.parentTask.taskId,
      transactionId: nextTaskPath.parentTask.transactionId,
      status: State.TaskStates.Completed,
      isSystem: true,
    });
    return;
  }

  // For child of system task completed but have next siblin to run
  if (!nextTaskPath.isCompleted && nextTaskPath.taskPath) {
    await taskInstanceStore.create(workflow, nextTaskPath.taskPath, tasksData);
    return;
  }

  // All tasks's complated update workflow
  if (nextTaskPath.isCompleted) {
    // When workflow is completed
    const completedWorkflow = await workflowInstanceStore.update({
      transactionId: task.transactionId,
      workflowId: task.workflowId,
      status: State.WorkflowStates.Completed,
      output: mapParametersToValue(
        workflow.workflowDefinition.outputParameters,
        {
          ...tasksData,
          workflow,
        },
      ),
    });

    if (!completedWorkflow) {
      throw new Error(`Cannot update workflow: ${task.workflowId}`);
    }

    switch (workflow.type) {
      case Workflow.WorkflowTypes.Workflow:
        await handleCompletedWorkflow(completedWorkflow);
        break;
      case Workflow.WorkflowTypes.CompensateWorkflow:
        await handleCompletedCompensateWorkflow(completedWorkflow);
        break;
      case Workflow.WorkflowTypes.CompensateThenRetryWorkflow:
        await handleCompletedCompensateThenRetryWorkflow(completedWorkflow);
        break;
      case Workflow.WorkflowTypes.CancelWorkflow:
        await handleCompletedCancelWorkflow(completedWorkflow);
        break;
      default:
        break;
    }
  }
};

const handleRetryWorkflow = async (
  workflow: Workflow.IWorkflow,
): Promise<void> => {
  if (workflow.retries > 0) {
    await workflowInstanceStore.reload(workflow);
    return;
  }
  await handleFailedWorkflow(workflow);
  return;
};

const handleCompensateWorkflow = async (
  workflow: Workflow.IWorkflow,
  isCancel: boolean = false,
): Promise<void> => {
  const tasksTocompensate = await workflowInstanceStore.compensate(
    workflow,
    isCancel
      ? Workflow.WorkflowTypes.CancelWorkflow
      : Workflow.WorkflowTypes.CompensateWorkflow,
    true,
  );

  if (tasksTocompensate === 0) {
    if (isCancel) {
      await handleCompletedCancelWorkflow(workflow);
    } else {
      await handleCompletedCompensateWorkflow(workflow);
    }
  }
};

const handleCompensateThenRetryWorkflow = async (
  workflow: Workflow.IWorkflow,
): Promise<void> => {
  const tasksToCompensate = await workflowInstanceStore.compensate(
    workflow,
    Workflow.WorkflowTypes.CompensateThenRetryWorkflow,
    true,
  );

  if (tasksToCompensate === 0) {
    await handleCompletedCompensateThenRetryWorkflow(workflow);
  }
};

const handleFailedWorkflow = (workflow: Workflow.IWorkflow) =>
  transactionInstanceStore.update({
    transactionId: workflow.transactionId,
    status: State.TransactionStates.Failed,
  });

const getWorkflowStatusFromTaskStatus = (
  taskStatus: State.TaskStates,
): State.WorkflowStates => {
  switch (taskStatus) {
    case State.TaskStates.Completed:
      return State.WorkflowStates.Completed;
    case State.TaskStates.AckTimeOut:
    case State.TaskStates.Timeout:
      return State.WorkflowStates.Timeout;
    case State.TaskStates.Failed:
      return State.WorkflowStates.Failed;
    default:
      return State.WorkflowStates.Failed;
  }
};

const isHaveRunningTasks = (tasks: Task.ITask[]): boolean =>
  tasks.filter(
    (taskData: Task.ITask) =>
      [State.TaskStates.Inprogress, State.TaskStates.Scheduled].includes(
        taskData.status,
      ) &&
      [
        Task.TaskTypes.Task,
        Task.TaskTypes.Schedule,
        Task.TaskTypes.SubTransaction,
      ].includes(taskData.type),
  ).length > 0;

const handleWorkflowFailureStrategy = async (
  task: Task.ITask,
  tasksDataList: Task.ITask[],
) => {
  // Wait for every tasks to finish before start recovery
  if (!isHaveRunningTasks(tasksDataList)) {
    const workflow = await workflowInstanceStore.update({
      transactionId: task.transactionId,
      workflowId: task.workflowId,
      status: getWorkflowStatusFromTaskStatus(task.status),
    });

    if (!workflow) {
      throw new Error(`Cannot update workflow: ${task.workflowId}`);
    }

    switch (workflow.workflowDefinition.failureStrategy) {
      case State.WorkflowFailureStrategies.Retry:
        await handleRetryWorkflow(workflow);
        break;
      case State.WorkflowFailureStrategies.Compensate:
        await handleCompensateWorkflow(workflow);
        break;
      case State.WorkflowFailureStrategies.CompensateThenRetry:
        await handleCompensateThenRetryWorkflow(workflow);
        break;
      case State.WorkflowFailureStrategies.Failed:
        await handleFailedWorkflow(workflow);
        break;
    }
  }
};

const handleFailedTask = async (
  task: Task.ITask,
  doNotRetry: boolean = false,
) => {
  const { workflow, tasksData, nextTaskPath } = await getTaskInfo(task);
  // If workflow oncancle do not retry or anything
  if (workflow.status === State.WorkflowStates.Cancelled) {
    if (nextTaskPath.parentTask) {
      await processUpdateTask({
        taskId: nextTaskPath.parentTask.taskId,
        transactionId: nextTaskPath.parentTask.transactionId,
        status: State.TaskStates.Completed,
        isSystem: true,
      });
    }

    await handleCancelWorkflow(workflow, tasksData);
    return;
  }

  // Check if can retry the task
  if (
    task.retries > 0 &&
    task.type !== Task.TaskTypes.Compensate &&
    !doNotRetry
  ) {
    await taskInstanceStore.reload(
      {
        ...task,
        retries: task.retries - 1,
        isRetried: true,
      },
      task.retryDelay <= 0,
    );
  } else {
    // For all childs task failed => update parent task to failed aswell
    if (nextTaskPath.isLastChild && nextTaskPath.parentTask) {
      await processUpdateTask({
        taskId: nextTaskPath.parentTask.taskId,
        transactionId: nextTaskPath.parentTask.transactionId,
        status: State.TaskStates.Failed,
        isSystem: true,
      });
    } else {
      const tasksDataList = R.values(tasksData);
      await handleWorkflowFailureStrategy(task, tasksDataList);
    }
  }
};

export const processUpdateTask = async (
  taskUpdate: Event.ITaskUpdate,
): Promise<void> => {
  try {
    const task = await taskInstanceStore.update(taskUpdate);
    if (!task) return;

    switch (taskUpdate.status) {
      case State.TaskStates.Completed:
        await handleCompletedTask(task);
        break;
      case State.TaskStates.Failed:
      case State.TaskStates.Timeout:
      case State.TaskStates.AckTimeOut:
        await handleFailedTask(task, taskUpdate.doNotRetry);
        break;
      default:
        // Case Inprogress we did't need to do anything except update the status
        break;
    }
  } catch (error) {
    sendEvent({
      transactionId: taskUpdate.transactionId,
      type: 'SYSTEM',
      isError: true,
      error: error.toString(),
      details: taskUpdate,
      timestamp: Date.now(),
    });
  }
};

export const processUpdateTasks = async (
  tasksUpdate: Event.ITaskUpdate[],
): Promise<any> => {
  for (const taskUpdate of tasksUpdate) {
    const hrStart = process.hrtime();
    await processUpdateTask(taskUpdate);
    const hrEnd = process.hrtime(hrStart);
    dg(
      `Updated ${taskUpdate.transactionId}:${taskUpdate.taskId} to ${
        taskUpdate.status
      } take ${hrEnd[0]}s ${hrEnd[1] / 1000000}ms`,
    );
  }
};

export const executor = async () => {
  while (true) {
    try {
      const tasksUpdate: Event.ITaskUpdate[] = await poll(
        stateConsumerClient,
        200,
      );
      if (tasksUpdate.length) {
        // Grouped by workflowId, so it can execute parallely, but same workflowId have to run sequential bacause it can effect each other
        const groupedTasks = R.values(
          R.groupBy(R.path(['workflowId']), tasksUpdate),
        );

        await Promise.all(
          groupedTasks.map((workflowTasksUpdate: Event.ITaskUpdate[]) =>
            processUpdateTasks(workflowTasksUpdate),
          ),
        );

        stateConsumerClient.commit();
      }
    } catch (error) {
      // Handle error here
      console.warn('state', error);
      await sleep(1000);
    }
  }
};
