import {
  State,
  Task,
  TaskDefinition,
  WorkflowDefinition,
} from '@melonade/melonade-declaration';

export const TASKS: TaskDefinition.ITaskDefinition[] = [
  {
    name: 't1',
  },
  {
    name: 't2',
  },
  {
    name: 't3',
  },
];

export const WORKFLOW: WorkflowDefinition.IWorkflowDefinition = {
  name: 'simple',
  rev: '1',
  description: 'Sample workflow',
  tasks: [
    {
      name: 't1',
      taskReferenceName: 't1',
      type: Task.TaskTypes.Task,
      inputParameters: {
        hello: '${workflow.input.hello}',
      },
      ackTimeout: 1000,
      timeout: 30000,
    },
    {
      name: 't2',
      taskReferenceName: 't2',
      type: Task.TaskTypes.Task,
      inputParameters: {
        hello: '${t1.output.hello}',
      },
      ackTimeout: 1000,
      timeout: 30000,
    },
    {
      name: 't3',
      taskReferenceName: 't3',
      type: Task.TaskTypes.Task,
      inputParameters: {
        hello: '${t2.output.hello}',
      },
      ackTimeout: 1000,
      timeout: 30000,
    },
  ],
  failureStrategy: State.WorkflowFailureStrategies.CompensateThenRetry,
  outputParameters: {
    t1_hello: '${t1.output.hello}',
    t2_hello: '${t2.output.hello}',
    t3_hello: '${t3.output.hello}',
  },
};
