import {
  Event,
  State,
  Task,
  Timer,
  Workflow,
  WorkflowDefinition,
} from '@melonade/melonade-declaration';
import * as R from 'ramda';
import { poll, sendEvent, sendTimer, stateConsumerClient } from './kafka';
import {
  taskInstanceStore,
  transactionInstanceStore,
  workflowInstanceStore,
} from './store';
import { toObjectByKey } from './utils/common';
import { mapParametersToValue } from './utils/task';

export const isAllCompleted = R.all(
  R.pathEq(['status'], State.TaskStates.Completed),
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

const isGotNextTaskToRun = (
  tasks: WorkflowDefinition.AllTaskType[],
  currentPath: (string | number)[],
): boolean => !!R.path(getNextPath(currentPath), tasks);

const isTaskOfParallelTask = (
  tasks: WorkflowDefinition.AllTaskType[],
  currentPath: (string | number)[],
): boolean =>
  R.pathEq(
    [...R.dropLast(3, currentPath), 'type'],
    Task.TaskTypes.Parallel,
    tasks,
  );

const getNextParallelTask = (
  tasks: WorkflowDefinition.AllTaskType[],
  currentPath: (string | number)[],
  taskData: { [taskReferenceName: string]: Task.ITask } = {},
): { isCompleted: boolean; taskPath: (string | number)[] } => {
  // If still got next task in line
  if (R.path(getNextPath(currentPath), tasks)) {
    return {
      isCompleted: false,
      taskPath: getNextPath(currentPath),
    };
  }

  const allTaskStatuses = R.pathOr([], R.dropLast(2, currentPath), tasks).map(
    (pTask: WorkflowDefinition.AllTaskType[]) =>
      R.path([R.last(pTask).taskReferenceName], taskData),
  );
  // All of line are completed
  if (isAllCompleted(allTaskStatuses)) {
    return getNextTaskPath(tasks, R.dropLast(3, currentPath), taskData);
  }
  // Wait for other line
  return {
    isCompleted: false,
    taskPath: null,
  };
};

// Check if it's system task
export const getNextTaskPath = (
  tasks: WorkflowDefinition.AllTaskType[],
  currentPath: (string | number)[],
  taskData: { [taskReferenceName: string]: Task.ITask } = {},
): { isCompleted: boolean; taskPath: (string | number)[] } => {
  // Check if this's the final task
  if (R.equals([tasks.length - 1], currentPath))
    return { isCompleted: true, taskPath: null };

  if (isTaskOfParallelTask(tasks, currentPath))
    return getNextParallelTask(tasks, currentPath, taskData);

  if (isChildOfDecisionDefault(tasks, currentPath)) {
    if (R.path(getNextPath(currentPath), tasks)) {
      return { isCompleted: false, taskPath: getNextPath(currentPath) };
    }
    return getNextTaskPath(tasks, R.dropLast(2, currentPath), taskData);
  }

  if (isChildOfDecisionCase(tasks, currentPath)) {
    if (R.path(getNextPath(currentPath), tasks)) {
      return { isCompleted: false, taskPath: getNextPath(currentPath) };
    }
    return getNextTaskPath(tasks, R.dropLast(3, currentPath), taskData);
  }

  if (isGotNextTaskToRun(tasks, currentPath))
    return { isCompleted: false, taskPath: getNextPath(currentPath) };

  throw new Error('Task is invalid');
};

const findNextParallelTaskPath = (
  taskReferenceName: string,
  tasks: WorkflowDefinition.AllTaskType[],
  currentPath: (string | number)[],
  currentTask: WorkflowDefinition.IParallelTask,
) => {
  for (
    let pTasksIndex = 0;
    pTasksIndex < currentTask.parallelTasks.length;
    pTasksIndex++
  ) {
    const taskPath = findTaskPath(taskReferenceName, tasks, [
      ...currentPath,
      'parallelTasks',
      pTasksIndex,
      0,
    ]);
    if (taskPath) return taskPath;
  }
  return findTaskPath(taskReferenceName, tasks, getNextPath(currentPath));
};

const findNextDecisionTaskPath = (
  taskReferenceName: string,
  tasks: WorkflowDefinition.AllTaskType[],
  currentPath: (string | number)[],
  currentTask: WorkflowDefinition.IDecisionTask,
) => {
  const decisionsPath = [
    ...Object.keys(currentTask.decisions).map((decision: string) => [
      'decisions',
      decision,
    ]),
    ['defaultDecision'],
  ];
  for (const decisionPath of decisionsPath) {
    const taskPath = findTaskPath(taskReferenceName, tasks, [
      ...currentPath,
      ...decisionPath,
      0,
    ]);
    if (taskPath) return taskPath;
  }
  return findTaskPath(taskReferenceName, tasks, getNextPath(currentPath));
};

export const findTaskPath = (
  taskReferenceName: string,
  tasks: WorkflowDefinition.AllTaskType[],
  currentPath: (string | number)[] = [0],
): (string | number)[] => {
  const currentTask: WorkflowDefinition.AllTaskType = R.path(
    currentPath,
    tasks,
  );
  if (currentTask)
    if (currentTask.taskReferenceName === taskReferenceName) return currentPath;
    else
      switch (currentTask.type) {
        case Task.TaskTypes.Parallel:
          return findNextParallelTaskPath(
            taskReferenceName,
            tasks,
            currentPath,
            currentTask,
          );
        case Task.TaskTypes.Decision:
          return findNextDecisionTaskPath(
            taskReferenceName,
            tasks,
            currentPath,
            currentTask,
          );
        case Task.TaskTypes.SubWorkflow:
        case Task.TaskTypes.Task:
        case Task.TaskTypes.Compensate:
        default:
          return findTaskPath(
            taskReferenceName,
            tasks,
            getNextPath(currentPath),
          );
      }
  else return null;
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
  const currentTaskPath = findTaskPath(
    task.taskReferenceName,
    workflow.workflowDefinition.tasks,
  );
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
      undefined,
      {
        retries: workflow.retries - 1,
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
      case State.WorkflowFailureStrategies.RecoveryWorkflow:
        await handleRecoveryWorkflow(workflow, tasksDataList, true);
        break;
      case State.WorkflowFailureStrategies.Compensate:
      case State.WorkflowFailureStrategies.CompensateThenRetry:
        await handleCompenstateWorkflow(workflow, tasksDataList, true);

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
  if (workflow.status === State.WorkflowStates.Cancelled) {
    await handleCancelWorkflow(workflow, tasksData);
    return;
  }

  if (!nextTaskPath.isCompleted && nextTaskPath.taskPath) {
    await taskInstanceStore.create(
      workflow,
      R.path(nextTaskPath.taskPath, workflow.workflowDefinition.tasks),
      tasksData,
      true,
    );
    return;
  }

  if (!nextTaskPath.isCompleted && !nextTaskPath.taskPath) {
    const tasksDataList = R.values(tasksData);

    const failedTasks = tasksDataList.filter((task: Task.ITask) =>
      [
        State.TaskStates.Failed,
        State.TaskStates.AckTimeOut,
        State.TaskStates.Timeout,
      ].includes(task.status),
    );

    if (failedTasks.length) {
      await handleWorkflowFailureStrategy(failedTasks[0], tasksDataList);
      return;
    }
  }

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
      case Workflow.WorkflowTypes.SubWorkflow:
        await handleCompletedTask(
          await taskInstanceStore.get(completedWorkflow.childOf),
        );
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

const getCompenstateTasks = R.compose(
  R.map(
    (task: Task.ITask): WorkflowDefinition.AllTaskType => {
      return {
        name: task.taskName,
        taskReferenceName: task.taskReferenceName,
        type: Task.TaskTypes.Compensate,
        inputParameters: {
          input: `\${workflow.input.${task.taskReferenceName}.input}`,
          output: `\${workflow.input.${task.taskReferenceName}.output}`,
        },
      };
    },
  ),
  R.sort((taskA: Task.ITask, taskB: Task.ITask): number => {
    return taskB.endTime - taskA.endTime;
  }),
  R.filter((task: Task.ITask | any): boolean => {
    return (
      task.type === Task.TaskTypes.Task &&
      task.status === State.TaskStates.Completed
    );
  }),
);

const handleRecoveryWorkflow = async (
  workflow: Workflow.IWorkflow,
  tasksData: Task.ITask[],
  isCancel: boolean = false,
): Promise<void> => {
  await workflowInstanceStore.create(
    workflow.transactionId,
    isCancel
      ? Workflow.WorkflowTypes.CancelWorkflow
      : Workflow.WorkflowTypes.CompensateWorkflow,
    workflow.workflowDefinition,
    toObjectByKey(tasksData, 'taskReferenceName'),
  );
};

const handleRetryWorkflow = async (
  workflow: Workflow.IWorkflow,
  tasksData: Task.ITask[],
): Promise<void> => {
  if (workflow.retries > 0) {
    await workflowInstanceStore.create(
      workflow.transactionId,
      Workflow.WorkflowTypes.Workflow,
      workflow.workflowDefinition,
      tasksData,
      undefined,
      {
        retries: workflow.retries - 1,
      },
    );
    return;
  }
  await handleFailedWorkflow(workflow);
  return;
};

const handleCompenstateWorkflow = (
  workflow: Workflow.IWorkflow,
  tasksData: Task.ITask[],
  isCancel: boolean = false,
) => {
  const compenstateTasks = getCompenstateTasks(tasksData);
  if (compenstateTasks.length) {
    return workflowInstanceStore.create(
      workflow.transactionId,
      isCancel
        ? Workflow.WorkflowTypes.CancelWorkflow
        : Workflow.WorkflowTypes.CompensateWorkflow,
      {
        name: workflow.workflowDefinition.name,
        rev: `${workflow.workflowDefinition.rev}_compensate`,
        tasks: compenstateTasks,
        failureStrategy: State.WorkflowFailureStrategies.Failed,
        outputParameters: {},
      },
      toObjectByKey(tasksData, 'taskReferenceName'),
    );
  } else {
    if (isCancel) {
      return handleCompletedCancelWorkflow(workflow);
    }
    return handleCompletedCompensateWorkflow(workflow);
  }
};

const handleCompenstateThenRetryWorkflow = (
  workflow: Workflow.IWorkflow,
  tasksData: Task.ITask[],
) => {
  const compenstateTasks = getCompenstateTasks(tasksData);
  if (compenstateTasks.length) {
    return workflowInstanceStore.create(
      workflow.transactionId,
      Workflow.WorkflowTypes.CompensateThenRetryWorkflow,
      {
        name: workflow.workflowDefinition.name,
        rev: `${workflow.workflowDefinition.rev}_compensate`,
        tasks: getCompenstateTasks(tasksData),
        failureStrategy: State.WorkflowFailureStrategies.Failed,
        outputParameters: {},
      },
      toObjectByKey(tasksData, 'taskReferenceName'),
      undefined,
      {
        retries: workflow.retries,
      },
    );
  } else {
    return handleCompletedCompensateThenRetryWorkflow(workflow);
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

const handleWorkflowFailureStrategy = async (
  task: Task.ITask,
  tasksDataList: Task.ITask[],
) => {
  const runningTasks = tasksDataList.filter((taskData: Task.ITask) => {
    return (
      [State.TaskStates.Inprogress, State.TaskStates.Scheduled].includes(
        taskData.status,
      ) && taskData.taskReferenceName !== task.taskReferenceName
    );
  });

  // No running task, start recovery
  // If there are running task wait for them first
  if (runningTasks.length === 0) {
    const workflow = await workflowInstanceStore.update({
      transactionId: task.transactionId,
      workflowId: task.workflowId,
      status: getWorkflowStatusFromTaskStatus(task.status),
    });

    if (!workflow) {
      throw new Error(`Cannot update workflow: ${task.workflowId}`);
    }

    switch (workflow.workflowDefinition.failureStrategy) {
      case State.WorkflowFailureStrategies.RecoveryWorkflow:
        await handleRecoveryWorkflow(workflow, tasksDataList);
        break;
      case State.WorkflowFailureStrategies.Retry:
        await handleRetryWorkflow(workflow, tasksDataList);
        break;
      case State.WorkflowFailureStrategies.Compensate:
        await handleCompenstateWorkflow(workflow, tasksDataList);
        break;
      case State.WorkflowFailureStrategies.CompensateThenRetry:
        await handleCompenstateThenRetryWorkflow(workflow, tasksDataList);
        break;
      case State.WorkflowFailureStrategies.Failed:
        await handleFailedWorkflow(workflow);
        break;
    }
  }
};

const handleFailedTask = async (task: Task.ITask) => {
  const { workflow, tasksData } = await getTaskInfo(task);
  // If workflow oncancle do not retry or anything
  if (workflow.status === State.WorkflowStates.Cancelled) {
    await handleCancelWorkflow(workflow, tasksData);
    return;
  }

  // if cannot retry anymore
  if (task.retries <= 0) {
    const tasksDataList = R.values(tasksData);
    await handleWorkflowFailureStrategy(task, tasksDataList);
  } else {
    sendTimer({
      type: Timer.TimerType.delayTask,
      task: {
        ...task,
        retries: task.retries - 1,
      },
    });
  }
};

export const processUpdatedTasks = async (
  tasksUpdate: Event.ITaskUpdate[],
): Promise<any> => {
  for (const taskUpdate of tasksUpdate) {
    // console.time(`${taskUpdate.taskId}-${taskUpdate.status}`);
    try {
      const task = await taskInstanceStore.update(taskUpdate);
      if (!task) continue;

      switch (taskUpdate.status) {
        case State.TaskStates.Completed:
          await handleCompletedTask(task);
          break;
        case State.TaskStates.Failed:
        case State.TaskStates.Timeout:
        case State.TaskStates.AckTimeOut:
          await handleFailedTask(task);
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
    // console.timeEnd(`${taskUpdate.taskId}-${taskUpdate.status}`);
  }
};

export const executor = async () => {
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
          processUpdatedTasks(workflowTasksUpdate),
        ),
      );

      stateConsumerClient.commit();
    }
  } catch (error) {
    // Handle error here
    console.log(error);
  } finally {
    setImmediate(executor);
  }
};
