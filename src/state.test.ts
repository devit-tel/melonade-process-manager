import {
  State,
  Task,
  WorkflowDefinition,
} from '@melonade/melonade-declaration';
import * as state from './state';

// Don't test async function here, because of they are stores
// We have to test those on integate test

jest.mock('./kafka');
jest.mock('./store');

describe('isAllCompleted', () => {
  test('All tasks completed', () => {
    expect(
      state.isAllCompleted([
        {
          taskName: 'taskName',
          taskReferenceName: 'taskReferenceName',
          taskId: 'taskId',
          workflowId: 'workflowId',
          transactionId: 'transactionId',
          status: State.TaskStates.Completed,
        },
        {
          taskName: 'taskName',
          taskReferenceName: 'taskReferenceName',
          taskId: 'taskId',
          workflowId: 'workflowId',
          transactionId: 'transactionId',
          status: State.TaskStates.Completed,
        },
        {
          taskName: 'taskName',
          taskReferenceName: 'taskReferenceName',
          taskId: 'taskId',
          workflowId: 'workflowId',
          transactionId: 'transactionId',
          status: State.TaskStates.Completed,
        },
      ]),
    ).toBe(true);
  });

  test('One tasks failed', () => {
    expect(
      state.isAllCompleted([
        {
          taskName: 'taskName',
          taskReferenceName: 'taskReferenceName',
          taskId: 'taskId',
          workflowId: 'workflowId',
          transactionId: 'transactionId',
          status: State.TaskStates.Completed,
        },
        {
          taskName: 'taskName',
          taskReferenceName: 'taskReferenceName',
          taskId: 'taskId',
          workflowId: 'workflowId',
          transactionId: 'transactionId',
          status: State.TaskStates.Completed,
        },
        {
          taskName: 'taskName',
          taskReferenceName: 'taskReferenceName',
          taskId: 'taskId',
          workflowId: 'workflowId',
          transactionId: 'transactionId',
          status: State.TaskStates.Failed,
        },
      ]),
    ).toBe(false);
  });

  test('One task running', () => {
    expect(
      state.isAllCompleted([
        {
          taskName: 'taskName',
          taskReferenceName: 'taskReferenceName',
          taskId: 'taskId',
          workflowId: 'workflowId',
          transactionId: 'transactionId',
          status: State.TaskStates.Completed,
        },
        {
          taskName: 'taskName',
          taskReferenceName: 'taskReferenceName',
          taskId: 'taskId',
          workflowId: 'workflowId',
          transactionId: 'transactionId',
          status: State.TaskStates.Completed,
        },
        {
          taskName: 'taskName',
          taskReferenceName: 'taskReferenceName',
          taskId: 'taskId',
          workflowId: 'workflowId',
          transactionId: 'transactionId',
          status: State.TaskStates.Inprogress,
        },
      ]),
    ).toBe(false);
  });

  test('All tasks running', () => {
    expect(
      state.isAllCompleted([
        {
          taskName: 'taskName',
          taskReferenceName: 'taskReferenceName',
          taskId: 'taskId',
          workflowId: 'workflowId',
          transactionId: 'transactionId',
          status: State.TaskStates.Inprogress,
        },
        {
          taskName: 'taskName',
          taskReferenceName: 'taskReferenceName',
          taskId: 'taskId',
          workflowId: 'workflowId',
          transactionId: 'transactionId',
          status: State.TaskStates.Inprogress,
        },
        {
          taskName: 'taskName',
          taskReferenceName: 'taskReferenceName',
          taskId: 'taskId',
          workflowId: 'workflowId',
          transactionId: 'transactionId',
          status: State.TaskStates.Inprogress,
        },
      ]),
    ).toBe(false);
  });
});

describe('getNextPath', () => {
  test('return next path', () => {
    expect(state.getNextPath([0, 'parallelTasks', 0, 0])).toEqual([
      0,
      'parallelTasks',
      0,
      1,
    ]);
  });

  test('return next path', () => {
    expect(state.getNextPath([1, 0])).toEqual([1, 1]);
  });

  test('return next path', () => {
    expect(state.getNextPath([20])).toEqual([21]);
  });
});

describe('isChildOfDecisionDefault', () => {
  const exampleTasks: WorkflowDefinition.AllTaskType[] = [
    {
      name: 'name',
      taskReferenceName: 'taskReferenceName',
      inputParameters: {},
      type: Task.TaskTypes.Task,
    },
    {
      name: 'name',
      taskReferenceName: 'taskReferenceName',
      inputParameters: {},
      type: Task.TaskTypes.Decision,
      decisions: {
        case1: [
          {
            name: 'name',
            taskReferenceName: 'taskReferenceName',
            inputParameters: {},
            type: Task.TaskTypes.Task,
          },
          {
            name: 'name',
            taskReferenceName: 'taskReferenceName',
            inputParameters: {},
            type: Task.TaskTypes.Task,
          },
        ],
        case2: [
          {
            name: 'name',
            taskReferenceName: 'taskReferenceName',
            inputParameters: {},
            type: Task.TaskTypes.Task,
          },
          {
            name: 'name',
            taskReferenceName: 'taskReferenceName',
            inputParameters: {},
            type: Task.TaskTypes.Task,
          },
        ],
      },
      defaultDecision: [
        {
          name: 'name',
          taskReferenceName: 'taskReferenceName',
          inputParameters: {},
          type: Task.TaskTypes.Task,
        },
        {
          name: 'name',
          taskReferenceName: 'taskReferenceName',
          inputParameters: {},
          type: Task.TaskTypes.Task,
        },
        {
          name: 'name',
          taskReferenceName: 'taskReferenceName',
          inputParameters: {},
          type: Task.TaskTypes.Parallel,
          parallelTasks: [
            [
              {
                name: 'name',
                taskReferenceName: 'taskReferenceName',
                inputParameters: {},
                type: Task.TaskTypes.Task,
              },
            ],
            [
              {
                name: 'name',
                taskReferenceName: 'taskReferenceName',
                inputParameters: {},
                type: Task.TaskTypes.Task,
              },
            ],
          ],
        },
      ],
    },
    {
      name: 'name',
      taskReferenceName: 'taskReferenceName',
      inputParameters: {},
      type: Task.TaskTypes.Parallel,
      parallelTasks: [
        [
          {
            name: 'name',
            taskReferenceName: 'taskReferenceName',
            inputParameters: {},
            type: Task.TaskTypes.Task,
          },
        ],
        [
          {
            name: 'name',
            taskReferenceName: 'taskReferenceName',
            inputParameters: {},
            type: Task.TaskTypes.Task,
          },
        ],
      ],
    },
  ];

  test('Child Of decision default case', () => {
    expect(
      state.isChildOfDecisionDefault(exampleTasks, [1, 'defaultDecision', 0]),
    ).toBe(true);

    expect(
      state.isChildOfDecisionDefault(exampleTasks, [1, 'defaultDecision', 2]),
    ).toBe(true);
  });

  test('Child of decision matched case', () => {
    expect(
      state.isChildOfDecisionDefault(exampleTasks, [
        1,
        'decisions',
        'case1',
        0,
      ]),
    ).toBe(false);

    expect(
      state.isChildOfDecisionDefault(exampleTasks, [
        1,
        'decisions',
        'case2',
        0,
      ]),
    ).toBe(false);
  });

  test('decision task itself', () => {
    expect(state.isChildOfDecisionDefault(exampleTasks, [1])).toBe(false);
  });

  test('Grandchild of decision default case', () => {
    expect(
      state.isChildOfDecisionDefault(exampleTasks, [
        1,
        'defaultDecision',
        2,
        'parallelTasks',
        0,
        0,
      ]),
    ).toBe(false);
  });

  test('Not a child of decision default case', () => {
    expect(state.isChildOfDecisionDefault(exampleTasks, [0])).toBe(false);

    expect(state.isChildOfDecisionDefault(exampleTasks, [2])).toBe(false);

    expect(
      state.isChildOfDecisionDefault(exampleTasks, [2, 'parallelTasks', 0, 0]),
    ).toBe(false);
  });
});

describe('isChildOfDecisionCase', () => {
  const exampleTasks: WorkflowDefinition.AllTaskType[] = [
    {
      name: 'name',
      taskReferenceName: 'taskReferenceName',
      inputParameters: {},
      type: Task.TaskTypes.Task,
    },
    {
      name: 'name',
      taskReferenceName: 'taskReferenceName',
      inputParameters: {},
      type: Task.TaskTypes.Decision,
      decisions: {
        case1: [
          {
            name: 'name',
            taskReferenceName: 'taskReferenceName',
            inputParameters: {},
            type: Task.TaskTypes.Task,
          },
          {
            name: 'name',
            taskReferenceName: 'taskReferenceName',
            inputParameters: {},
            type: Task.TaskTypes.Task,
          },
        ],
        case2: [
          {
            name: 'name',
            taskReferenceName: 'taskReferenceName',
            inputParameters: {},
            type: Task.TaskTypes.Task,
          },
          {
            name: 'name',
            taskReferenceName: 'taskReferenceName',
            inputParameters: {},
            type: Task.TaskTypes.Task,
          },
        ],
      },
      defaultDecision: [
        {
          name: 'name',
          taskReferenceName: 'taskReferenceName',
          inputParameters: {},
          type: Task.TaskTypes.Task,
        },
        {
          name: 'name',
          taskReferenceName: 'taskReferenceName',
          inputParameters: {},
          type: Task.TaskTypes.Task,
        },
        {
          name: 'name',
          taskReferenceName: 'taskReferenceName',
          inputParameters: {},
          type: Task.TaskTypes.Parallel,
          parallelTasks: [
            [
              {
                name: 'name',
                taskReferenceName: 'taskReferenceName',
                inputParameters: {},
                type: Task.TaskTypes.Task,
              },
            ],
            [
              {
                name: 'name',
                taskReferenceName: 'taskReferenceName',
                inputParameters: {},
                type: Task.TaskTypes.Task,
              },
            ],
          ],
        },
      ],
    },
    {
      name: 'name',
      taskReferenceName: 'taskReferenceName',
      inputParameters: {},
      type: Task.TaskTypes.Parallel,
      parallelTasks: [
        [
          {
            name: 'name',
            taskReferenceName: 'taskReferenceName',
            inputParameters: {},
            type: Task.TaskTypes.Task,
          },
        ],
        [
          {
            name: 'name',
            taskReferenceName: 'taskReferenceName',
            inputParameters: {},
            type: Task.TaskTypes.Task,
          },
        ],
      ],
    },
  ];

  test('Child Of decision default case', () => {
    expect(
      state.isChildOfDecisionCase(exampleTasks, [1, 'defaultDecision', 0]),
    ).toBe(false);

    expect(
      state.isChildOfDecisionCase(exampleTasks, [1, 'defaultDecision', 2]),
    ).toBe(false);
  });

  test('Child of decision matched case', () => {
    expect(
      state.isChildOfDecisionCase(exampleTasks, [1, 'decisions', 'case1', 0]),
    ).toBe(true);

    expect(
      state.isChildOfDecisionCase(exampleTasks, [1, 'decisions', 'case2', 0]),
    ).toBe(true);
  });

  test('decision task itself', () => {
    expect(state.isChildOfDecisionCase(exampleTasks, [1])).toBe(false);
  });

  test('Grandchild of decision default case', () => {
    expect(
      state.isChildOfDecisionCase(exampleTasks, [
        1,
        'defaultDecision',
        2,
        'parallelTasks',
        0,
        0,
      ]),
    ).toBe(false);
  });

  test('Not a child of decision default case', () => {
    expect(state.isChildOfDecisionCase(exampleTasks, [0])).toBe(false);

    expect(state.isChildOfDecisionCase(exampleTasks, [2])).toBe(false);

    expect(
      state.isChildOfDecisionCase(exampleTasks, [2, 'parallelTasks', 0, 0]),
    ).toBe(false);
  });
});

describe('getNextTaskPath', () => {
  const exampleTasks: WorkflowDefinition.AllTaskType[] = [
    {
      name: 'name',
      taskReferenceName: 't1',
      inputParameters: {},
      type: Task.TaskTypes.Task,
    },
    {
      name: 'name',
      taskReferenceName: 't2',
      inputParameters: {},
      type: Task.TaskTypes.Decision,
      decisions: {
        case1: [
          {
            name: 'name',
            taskReferenceName: 't3',
            inputParameters: {},
            type: Task.TaskTypes.Task,
          },
          {
            name: 'name',
            taskReferenceName: 't4',
            inputParameters: {},
            type: Task.TaskTypes.Task,
          },
        ],
        case2: [
          {
            name: 'name',
            taskReferenceName: 't5',
            inputParameters: {},
            type: Task.TaskTypes.Task,
          },
          {
            name: 'name',
            taskReferenceName: 't6',
            inputParameters: {},
            type: Task.TaskTypes.Task,
          },
        ],
      },
      defaultDecision: [
        {
          name: 'name',
          taskReferenceName: 't7',
          inputParameters: {},
          type: Task.TaskTypes.Task,
        },
        {
          name: 'name',
          taskReferenceName: 't8',
          inputParameters: {},
          type: Task.TaskTypes.Task,
        },
        {
          name: 'name',
          taskReferenceName: 't9',
          inputParameters: {},
          type: Task.TaskTypes.Parallel,
          parallelTasks: [
            [
              {
                name: 'name',
                taskReferenceName: 't10',
                inputParameters: {},
                type: Task.TaskTypes.Task,
              },
            ],
            [
              {
                name: 'name',
                taskReferenceName: 't11',
                inputParameters: {},
                type: Task.TaskTypes.Task,
              },
            ],
          ],
        },
      ],
    },
    {
      name: 'name',
      taskReferenceName: 't12',
      inputParameters: {},
      type: Task.TaskTypes.Parallel,
      parallelTasks: [
        [
          {
            name: 'name',
            taskReferenceName: 't13',
            inputParameters: {},
            type: Task.TaskTypes.Task,
          },
        ],
        [
          {
            name: 'name',
            taskReferenceName: 't14',
            inputParameters: {},
            type: Task.TaskTypes.Task,
          },
        ],
      ],
    },
  ];

  test('First task finished', () => {
    expect(state.getNextTaskPath(exampleTasks, [0], {})).toEqual({
      isCompleted: false,
      taskPath: [1],
    });
  });

  test('Child of Decisions task', () => {
    expect(
      state.getNextTaskPath(exampleTasks, [1, 'decisions', 'case1', 0], {}),
    ).toEqual({
      isCompleted: false,
      taskPath: [1, 'decisions', 'case1', 1],
    });
  });

  test('Child of Decisions task (last task)', () => {
    expect(
      state.getNextTaskPath(exampleTasks, [1, 'decisions', 'case1', 1], {}),
    ).toEqual({
      isCompleted: false,
      taskPath: [2],
    });
  });

  test('Child of Decisions task (completed)', () => {
    // Excluded last task
    expect(
      state.getNextTaskPath(
        [exampleTasks[0], exampleTasks[1]],
        [1, 'decisions', 'case1', 1],
        {},
      ),
    ).toEqual({
      isCompleted: true,
      taskPath: null,
    });
  });

  test('Child of Parallel (Wait)', () => {
    expect(
      state.getNextTaskPath(exampleTasks, [2, 'parallelTasks', 0, 0], {
        t13: {
          taskName: 'task',
          taskReferenceName: 't13',
          taskId: '',
          workflowId: '',
          transactionId: '',
          status: State.TaskStates.Completed,
          retries: 0,
          isRetried: false,
          input: {},
          output: {},
          createTime: 0,
          startTime: 0,
          endTime: 0,
          retryDelay: 0,
          ackTimeout: 0,
          timeout: 0,
          type: Task.TaskTypes.Task,
        },
        t14: {
          taskName: 'task',
          taskReferenceName: 't14',
          taskId: '',
          workflowId: '',
          transactionId: '',
          status: State.TaskStates.Inprogress,
          retries: 0,
          isRetried: false,
          input: {},
          output: {},
          createTime: 0,
          startTime: 0,
          endTime: 0,
          retryDelay: 0,
          ackTimeout: 0,
          timeout: 0,
          type: Task.TaskTypes.Task,
        },
      }),
    ).toEqual({
      isCompleted: false,
      taskPath: null,
    });
  });

  test('Child of Parallel (All completed)', () => {
    expect(
      state.getNextTaskPath(exampleTasks, [2, 'parallelTasks', 0, 0], {
        t13: {
          taskName: 'task',
          taskReferenceName: 't13',
          taskId: '',
          workflowId: '',
          transactionId: '',
          status: State.TaskStates.Completed,
          retries: 0,
          isRetried: false,
          input: {},
          output: {},
          createTime: 0,
          startTime: 0,
          endTime: 0,
          retryDelay: 0,
          ackTimeout: 0,
          timeout: 0,
          type: Task.TaskTypes.Task,
        },
        t14: {
          taskName: 'task',
          taskReferenceName: 't14',
          taskId: '',
          workflowId: '',
          transactionId: '',
          status: State.TaskStates.Completed,
          retries: 0,
          isRetried: false,
          input: {},
          output: {},
          createTime: 0,
          startTime: 0,
          endTime: 0,
          retryDelay: 0,
          ackTimeout: 0,
          timeout: 0,
          type: Task.TaskTypes.Task,
        },
      }),
    ).toEqual({
      isCompleted: true,
      taskPath: null,
    });
  });
});

describe('findTaskPath', () => {
  const exampleWorkflow: WorkflowDefinition.IWorkflowDefinition = {
    name: '',
    rev: '',
    description: '',
    failureStrategy: State.WorkflowFailureStrategies.Failed,
    outputParameters: {},
    tasks: [
      {
        name: 'name',
        taskReferenceName: 't1',
        inputParameters: {},
        type: Task.TaskTypes.Task,
      },
      {
        name: 'name',
        taskReferenceName: 't2',
        inputParameters: {},
        type: Task.TaskTypes.Decision,
        decisions: {
          case1: [
            {
              name: 'name',
              taskReferenceName: 't3',
              inputParameters: {},
              type: Task.TaskTypes.Task,
            },
            {
              name: 'name',
              taskReferenceName: 't4',
              inputParameters: {},
              type: Task.TaskTypes.Task,
            },
          ],
          case2: [
            {
              name: 'name',
              taskReferenceName: 't5',
              inputParameters: {},
              type: Task.TaskTypes.Task,
            },
            {
              name: 'name',
              taskReferenceName: 't6',
              inputParameters: {},
              type: Task.TaskTypes.Task,
            },
          ],
        },
        defaultDecision: [
          {
            name: 'name',
            taskReferenceName: 't7',
            inputParameters: {},
            type: Task.TaskTypes.Task,
          },
          {
            name: 'name',
            taskReferenceName: 't8',
            inputParameters: {},
            type: Task.TaskTypes.Task,
          },
          {
            name: 'name',
            taskReferenceName: 't9',
            inputParameters: {},
            type: Task.TaskTypes.Parallel,
            parallelTasks: [
              [
                {
                  name: 'name',
                  taskReferenceName: 't10',
                  inputParameters: {},
                  type: Task.TaskTypes.Task,
                },
              ],
              [
                {
                  name: 'name',
                  taskReferenceName: 't11',
                  inputParameters: {},
                  type: Task.TaskTypes.Task,
                },
              ],
            ],
          },
        ],
      },
      {
        name: 'name',
        taskReferenceName: 't12',
        inputParameters: {},
        type: Task.TaskTypes.Parallel,
        parallelTasks: [
          [
            {
              name: 'name',
              taskReferenceName: 't13',
              inputParameters: {},
              type: Task.TaskTypes.Task,
            },
          ],
          [
            {
              name: 'name',
              taskReferenceName: 't14',
              inputParameters: {},
              type: Task.TaskTypes.Task,
            },
          ],
        ],
      },
    ],
  };

  test('First task', () => {
    expect(state.findTaskPath('t1', exampleWorkflow.tasks)).toEqual([0]);
  });

  test('Find child of decisions case', () => {
    const spyFindTaskPath = jest.spyOn(state, 'findTaskPath');
    expect(state.findTaskPath('t4', exampleWorkflow.tasks)).toEqual([
      1,
      'decisions',
      'case1',
      1,
    ]);
    // findTaskPath have to recursive 4 time (From the begining) to find the task
    expect(spyFindTaskPath).toHaveBeenCalledTimes(4);
    spyFindTaskPath.mockRestore();
  });

  test('Find child of decisions case (Optimize)', () => {
    const spyFindTaskPath = jest.spyOn(state, 'findTaskPath');
    expect(
      state.findTaskPath('t4', exampleWorkflow.tasks, [
        1,
        'decisions',
        'case1',
        0,
      ]),
    ).toEqual([1, 'decisions', 'case1', 1]);
    // findTaskPath will start from current path
    expect(spyFindTaskPath).toHaveBeenCalledTimes(2);
    spyFindTaskPath.mockRestore();
  });

  test('Find child of decisions default', () => {
    expect(state.findTaskPath('t7', exampleWorkflow.tasks)).toEqual([
      1,
      'defaultDecision',
      0,
    ]);
  });
});
