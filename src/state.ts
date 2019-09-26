import * as R from 'ramda';
import { TaskStates, TaskTypes } from './constants/task';
import {
  FailureStrategies as WorkfloFailureStrategies,
  WorkflowStates,
  WorkflowTypes,
} from './constants/workflow';
import { poll, stateConsumerClient, sendEvent } from './kafka';
import {
  taskInstanceStore,
  workflowInstanceStore,
  transactionInstanceStore,
} from './store';
import {
  AllTaskType,
  IParallelTask,
  IDecisionTask,
} from './workflowDefinition';
import { IWorkflow } from './workflow';
import { ITask } from './task';
import { toObjectByKey } from './utils/common';
import { TransactionStates } from './constants/transaction';
import { mapParametersToValue } from './utils/task';

export interface ITransactionUpdate {
  transactionId: string;
  status: TransactionStates;
  output?: any;
}
export interface IWorkflowUpdate {
  transactionId: string;
  workflowId: string;
  status: WorkflowStates;
  output?: any;
}

export interface ITaskUpdate {
  transactionId: string;
  taskId: string;
  status: TaskStates;
  output?: any;
  logs?: any[] | any;
  isSystem: boolean;
}

const isAllCompleted = R.all(R.pathEq(['status'], TaskStates.Completed));

const getNextPath = (currentPath: (string | number)[]): (string | number)[] => [
  ...R.init(currentPath),
  +R.last(currentPath) + 1,
];

const isChildOfDecisionDefault = (
  tasks: AllTaskType[],
  currentPath: (string | number)[],
): boolean =>
  R.pathEq(
    [...R.dropLast(2, currentPath), 'type'],
    TaskTypes.Decision,
    tasks,
  ) && R.nth(-2, currentPath) === 'defaultDecision';

const isChildOfDecisionCase = (
  tasks: AllTaskType[],
  currentPath: (string | number)[],
): boolean =>
  R.pathEq(
    [...R.dropLast(3, currentPath), 'type'],
    TaskTypes.Decision,
    tasks,
  ) && R.nth(-3, currentPath) === 'decisions';

const isTaskOfActivityTask = (
  tasks: AllTaskType[],
  currentPath: (string | number)[],
): boolean => !!R.path(getNextPath(currentPath), tasks);

const isTaskOfParallelTask = (
  tasks: AllTaskType[],
  currentPath: (string | number)[],
): boolean =>
  R.pathEq([...R.dropLast(3, currentPath), 'type'], TaskTypes.Parallel, tasks);

const getNextParallelTask = (
  tasks: AllTaskType[],
  currentPath: (string | number)[],
  taskData: { [taskReferenceName: string]: ITask } = {},
): { isCompleted: boolean; taskPath: (string | number)[] } => {
  // If still got next task in line
  if (R.path(getNextPath(currentPath), tasks)) {
    return {
      isCompleted: false,
      taskPath: getNextPath(currentPath),
    };
  }

  const allTaskStatuses = R.pathOr([], R.dropLast(2, currentPath), tasks).map(
    (pTask: AllTaskType[]) =>
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
const getNextTaskPath = (
  tasks: AllTaskType[],
  currentPath: (string | number)[],
  taskData: { [taskReferenceName: string]: ITask } = {},
): { isCompleted: boolean; taskPath: (string | number)[] } => {
  // Check if this's the final task
  if (R.equals([tasks.length - 1], currentPath))
    return { isCompleted: true, taskPath: null };

  switch (true) {
    case isTaskOfParallelTask(tasks, currentPath):
      return getNextParallelTask(tasks, currentPath, taskData);
    case isChildOfDecisionDefault(tasks, currentPath):
      if (R.path(getNextPath(currentPath), tasks)) {
        return { isCompleted: false, taskPath: getNextPath(currentPath) };
      }
      return getNextTaskPath(tasks, R.dropLast(2, currentPath), taskData);
    case isChildOfDecisionCase(tasks, currentPath):
      if (R.path(getNextPath(currentPath), tasks)) {
        return { isCompleted: false, taskPath: getNextPath(currentPath) };
      }
      return getNextTaskPath(tasks, R.dropLast(3, currentPath), taskData);
    case isTaskOfActivityTask(tasks, currentPath):
      return { isCompleted: false, taskPath: getNextPath(currentPath) };
    // This case should never fall
    default:
      throw new Error('Task is invalid');
  }
};

const findNextParallelTaskPath = (
  taskReferenceName: string,
  tasks: AllTaskType[],
  currentPath: (string | number)[],
  currentTask: IParallelTask,
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
  tasks: AllTaskType[],
  currentPath: (string | number)[],
  currentTask: IDecisionTask,
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
  tasks: AllTaskType[],
  currentPath: (string | number)[] = [0],
): (string | number)[] => {
  const currentTask: AllTaskType = R.path(currentPath, tasks);
  if (currentTask)
    if (currentTask.taskReferenceName === taskReferenceName) return currentPath;
    else
      switch (currentTask.type) {
        case TaskTypes.Parallel:
          return findNextParallelTaskPath(
            taskReferenceName,
            tasks,
            currentPath,
            currentTask,
          );
        case TaskTypes.Decision:
          return findNextDecisionTaskPath(
            taskReferenceName,
            tasks,
            currentPath,
            currentTask,
          );
        case TaskTypes.SubWorkflow:
        case TaskTypes.Task:
        case TaskTypes.Compensate:
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
  workflow: IWorkflow,
): Promise<{ [taskReferenceName: string]: ITask }> => {
  const tasks = await taskInstanceStore.getAll(workflow.workflowId);
  return tasks.reduce((result: { [ref: string]: ITask }, task: ITask) => {
    result[task.taskReferenceName] = task;
    return result;
  }, {});
};

const getTaskInfo = async (task: ITask) => {
  const workflow: IWorkflow = await workflowInstanceStore.get(task.workflowId);

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

const handleCompletedWorkflow = async (workflow: IWorkflow) =>
  transactionInstanceStore.update({
    transactionId: workflow.transactionId,
    status: TransactionStates.Completed,
    output: workflow.output,
  });

const handleCompletedCompensateWorkflow = async (workflow: IWorkflow) =>
  transactionInstanceStore.update({
    transactionId: workflow.transactionId,
    status: TransactionStates.Compensated,
  });

const handleCompletedCompensateThenRetryWorkflow = async (
  workflow: IWorkflow,
) => {
  if (workflow.retries > 0) {
    const transaction = await transactionInstanceStore.get(
      workflow.transactionId,
    );
    await workflowInstanceStore.create(
      workflow.transactionId,
      WorkflowTypes.Workflow,
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

const handleCompletedTask = async (task: ITask) => {
  const { workflow, tasksData: taskData, nextTaskPath } = await getTaskInfo(
    task,
  );

  if (!nextTaskPath.isCompleted && nextTaskPath.taskPath) {
    await taskInstanceStore.create(
      workflow,
      R.path(nextTaskPath.taskPath, workflow.workflowDefinition.tasks),
      taskData,
      true,
    );
  } else if (nextTaskPath.isCompleted) {
    // When workflow is completed
    const completedWorkflow = await workflowInstanceStore.update({
      transactionId: task.transactionId,
      workflowId: task.workflowId,
      status: WorkflowStates.Completed,
      output: mapParametersToValue(
        workflow.workflowDefinition.outputParameters,
        {
          ...taskData,
          workflow,
        },
      ),
    });

    switch (workflow.type) {
      case WorkflowTypes.Workflow:
        await handleCompletedWorkflow(completedWorkflow);
        break;
      case WorkflowTypes.SubWorkflow:
        await handleCompletedTask(
          await taskInstanceStore.get(completedWorkflow.childOf),
        );
        break;
      case WorkflowTypes.CompensateWorkflow:
        await handleCompletedCompensateWorkflow(completedWorkflow);
        break;
      case WorkflowTypes.CompensateThenRetryWorkflow:
        await handleCompletedCompensateThenRetryWorkflow(completedWorkflow);
        break;
      default:
        break;
    }
  }
};

const getCompenstateTasks = R.compose(
  R.map(
    (task: ITask): AllTaskType => {
      return {
        name: task.taskName,
        taskReferenceName: task.taskReferenceName,
        type: TaskTypes.Compensate,
        inputParameters: {
          input: `\${workflow.input.${task.taskReferenceName}.input}`,
          output: `\${workflow.input.${task.taskReferenceName}.output}`,
        },
      };
    },
  ),
  R.sort((taskA: ITask, taskB: ITask): number => {
    return taskB.endTime - taskA.endTime;
  }),
  R.filter((task: ITask | any): boolean => {
    return task.type === TaskTypes.Task && task.status === TaskStates.Completed;
  }),
);

const handleRecoveryWorkflow = (workflow: IWorkflow, tasksData: ITask[]) =>
  workflowInstanceStore.create(
    workflow.transactionId,
    WorkflowTypes.Workflow,
    workflow.workflowDefinition,
    toObjectByKey(tasksData, 'taskReferenceName'),
  );

const handleRetryWorkflow = (workflow: IWorkflow, tasksData: ITask[]) => {
  if (workflow.retries > 0) {
    return workflowInstanceStore.create(
      workflow.transactionId,
      WorkflowTypes.Workflow,
      workflow.workflowDefinition,
      tasksData,
      undefined,
      {
        retries: workflow.retries - 1,
      },
    );
  }
  return handleFailedWorkflow(workflow);
};

const handleCompenstateWorkflow = (workflow: IWorkflow, tasksData: ITask[]) => {
  const compenstateTasks = getCompenstateTasks(tasksData);
  if (compenstateTasks.length) {
    return workflowInstanceStore.create(
      workflow.transactionId,
      WorkflowTypes.CompensateWorkflow,
      {
        name: workflow.workflowDefinition.name,
        rev: `${workflow.workflowDefinition.rev}_compensate`,
        tasks: compenstateTasks,
        failureStrategy: WorkfloFailureStrategies.Failed,
        outputParameters: {},
      },
      toObjectByKey(tasksData, 'taskReferenceName'),
    );
  } else {
    return handleCompletedCompensateWorkflow(workflow);
  }
};

const handleCompenstateThenRetryWorkflow = (
  workflow: IWorkflow,
  tasksData: ITask[],
) => {
  const compenstateTasks = getCompenstateTasks(tasksData);
  if (compenstateTasks.length) {
    return workflowInstanceStore.create(
      workflow.transactionId,
      WorkflowTypes.CompensateThenRetryWorkflow,
      {
        name: workflow.workflowDefinition.name,
        rev: `${workflow.workflowDefinition.rev}_compensate`,
        tasks: getCompenstateTasks(tasksData),
        failureStrategy: WorkfloFailureStrategies.Failed,
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
const handleFailedWorkflow = (workflow: IWorkflow) =>
  transactionInstanceStore.update({
    transactionId: workflow.transactionId,
    status: TransactionStates.Failed,
  });

const handleFailedTask = async (task: ITask) => {
  // if cannot retry anymore
  if (task.retries <= 0) {
    const tasksData = await taskInstanceStore.getAll(task.workflowId);
    const runningTasks = tasksData.filter((taskData: ITask) => {
      [TaskStates.Inprogress, TaskStates.Scheduled].includes(taskData.status) &&
        taskData.taskReferenceName !== task.taskReferenceName;
    });

    // No running task, start recovery
    // If there are running task wait for them first
    if (runningTasks.length === 0) {
      const workflow = await workflowInstanceStore.update({
        transactionId: task.transactionId,
        workflowId: task.workflowId,
        status: WorkflowStates.Failed,
      });
      switch (workflow.workflowDefinition.failureStrategy) {
        case WorkfloFailureStrategies.RecoveryWorkflow:
          await handleRecoveryWorkflow(workflow, tasksData);
          break;
        case WorkfloFailureStrategies.Retry:
          await handleRetryWorkflow(workflow, tasksData);
          break;
        case WorkfloFailureStrategies.Compensate:
          await handleCompenstateWorkflow(workflow, tasksData);
          break;
        case WorkfloFailureStrategies.CompensateThenRetry:
          await handleCompenstateThenRetryWorkflow(workflow, tasksData);
          break;
        case WorkfloFailureStrategies.Failed:
          await handleFailedWorkflow(workflow);
          break;
        default:
          break;
      }
    }
  }
};

const processTasksOfWorkflow = async (
  workflowTasksUpdate: ITaskUpdate[],
): Promise<any> => {
  for (const taskUpdate of workflowTasksUpdate) {
    // console.time(`${taskUpdate.taskId}-${taskUpdate.status}`);
    try {
      const task = await taskInstanceStore.update({
        ...taskUpdate,
        isSystem: false,
      });

      switch (taskUpdate.status) {
        case TaskStates.Completed:
          await handleCompletedTask(task);
          break;
        case TaskStates.Failed:
          await handleFailedTask(task);
          break;
        case TaskStates.Timeout:
          // Timeout task will make workflow timeout and manual fix
          await handleFailedTask(task);
          break;
        default:
          break;
      }
    } catch (error) {
      sendEvent({
        transactionId: taskUpdate.transactionId,
        type: 'SYSTEM',
        isError: true,
        error,
        details: taskUpdate,
        timestamp: Date.now(),
      });
    }
    // console.timeEnd(`${taskUpdate.taskId}-${taskUpdate.status}`);
  }
};

export const executor = async () => {
  try {
    const tasksUpdate: ITaskUpdate[] = await poll(stateConsumerClient, 200);
    if (tasksUpdate.length) {
      const groupedTasks = R.toPairs(
        R.groupBy(R.path(['workflowId']), tasksUpdate),
      );

      await Promise.all(
        groupedTasks.map(
          ([_workflowId, workflowTasksUpdate]: [string, ITaskUpdate[]]) =>
            processTasksOfWorkflow(workflowTasksUpdate),
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
