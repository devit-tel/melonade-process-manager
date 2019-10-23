import {
  State,
  Task,
  WorkflowDefinition,
} from '@melonade/melonade-declaration';
import {
  isAllCompleted,
  getNextPath,
  isChildOfDecisionDefault,
  isChildOfDecisionCase,
  getNextTaskPath,
} from './state';

describe('isAllCompleted', () => {
  test('All tasks completed', () => {
    expect(
      isAllCompleted([
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
      isAllCompleted([
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
      isAllCompleted([
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
      isAllCompleted([
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
    expect(getNextPath([0, 'parallelTasks', 0, 0])).toEqual([
      0,
      'parallelTasks',
      0,
      1,
    ]);
  });

  test('return next path', () => {
    expect(getNextPath([1, 0])).toEqual([1, 1]);
  });

  test('return next path', () => {
    expect(getNextPath([20])).toEqual([21]);
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
      isChildOfDecisionDefault(exampleTasks, [1, 'defaultDecision', 0]),
    ).toBe(true);

    expect(
      isChildOfDecisionDefault(exampleTasks, [1, 'defaultDecision', 2]),
    ).toBe(true);
  });

  test('Child of decision matched case', () => {
    expect(
      isChildOfDecisionDefault(exampleTasks, [1, 'decisions', 'case1', 0]),
    ).toBe(false);

    expect(
      isChildOfDecisionDefault(exampleTasks, [1, 'decisions', 'case2', 0]),
    ).toBe(false);
  });

  test('decision task itself', () => {
    expect(isChildOfDecisionDefault(exampleTasks, [1])).toBe(false);
  });

  test('Grandchild of decision default case', () => {
    expect(
      isChildOfDecisionDefault(exampleTasks, [
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
    expect(isChildOfDecisionDefault(exampleTasks, [0])).toBe(false);

    expect(isChildOfDecisionDefault(exampleTasks, [2])).toBe(false);

    expect(
      isChildOfDecisionDefault(exampleTasks, [2, 'parallelTasks', 0, 0]),
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
    expect(isChildOfDecisionCase(exampleTasks, [1, 'defaultDecision', 0])).toBe(
      false,
    );

    expect(isChildOfDecisionCase(exampleTasks, [1, 'defaultDecision', 2])).toBe(
      false,
    );
  });

  test('Child of decision matched case', () => {
    expect(
      isChildOfDecisionCase(exampleTasks, [1, 'decisions', 'case1', 0]),
    ).toBe(true);

    expect(
      isChildOfDecisionCase(exampleTasks, [1, 'decisions', 'case2', 0]),
    ).toBe(true);
  });

  test('decision task itself', () => {
    expect(isChildOfDecisionCase(exampleTasks, [1])).toBe(false);
  });

  test('Grandchild of decision default case', () => {
    expect(
      isChildOfDecisionCase(exampleTasks, [
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
    expect(isChildOfDecisionCase(exampleTasks, [0])).toBe(false);

    expect(isChildOfDecisionCase(exampleTasks, [2])).toBe(false);

    expect(
      isChildOfDecisionCase(exampleTasks, [2, 'parallelTasks', 0, 0]),
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
    expect(getNextTaskPath(exampleTasks, [0], {})).toEqual({
      isCompleted: false,
      taskPath: [1],
    });
  });

  test('Child of Decisions task', () => {
    expect(
      getNextTaskPath(exampleTasks, [1, 'decisions', 'case1', 0], {}),
    ).toEqual({
      isCompleted: false,
      taskPath: [1, 'decisions', 'case1', 1],
    });
  });

  test('Child of Decisions task (last task)', () => {
    expect(
      getNextTaskPath(exampleTasks, [1, 'decisions', 'case1', 1], {}),
    ).toEqual({
      isCompleted: false,
      taskPath: [2],
    });
  });

  test('Child of Decisions task (completed)', () => {
    // Excluded last task
    expect(
      getNextTaskPath(
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
      getNextTaskPath(exampleTasks, [2, 'parallelTasks', 0, 0], {
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
      getNextTaskPath(exampleTasks, [2, 'parallelTasks', 0, 0], {
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
