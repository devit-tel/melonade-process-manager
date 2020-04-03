import {
  State,
  Task,
  WorkflowDefinition,
} from '@melonade/melonade-declaration';
import * as R from 'ramda';
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

  const getTaskData = (
    taskReferenceName: string,
    type: Task.TaskTypes,
    taskPath: (string | number)[],
    status: State.TaskStates = State.TaskStates.Completed,
  ): Task.ITask => ({
    taskName: 'task',
    taskReferenceName,
    taskId: '',
    workflowId: '',
    transactionId: '',
    status,
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
    type,
    taskPath,
  });

  const mockTasksData = {
    t1: getTaskData('t1', Task.TaskTypes.Task, [0]),
    t2: getTaskData('t2', Task.TaskTypes.Decision, [1]),
    t3: getTaskData('t3', Task.TaskTypes.Task, [1, 'decisions', 'case1', 0]),
    t4: getTaskData('t4', Task.TaskTypes.Task, [1, 'decisions', 'case1', 1]),
    t5: getTaskData('t5', Task.TaskTypes.Task, [1, 'decisions', 'case2', 0]),
    t6: getTaskData('t6', Task.TaskTypes.Task, [1, 'decisions', 'case1', 1]),
    t7: getTaskData('t7', Task.TaskTypes.Task, [1, 'defaultDecision', 0]),
    t8: getTaskData('t8', Task.TaskTypes.Task, [1, 'defaultDecision', 1]),
    t9: getTaskData('t9', Task.TaskTypes.Parallel, [1, 'defaultDecision', 2]),
    t10: getTaskData('t10', Task.TaskTypes.Task, [
      1,
      'defaultDecision',
      2,
      'parallelTasks',
      0,
    ]),
    t11: getTaskData('t11', Task.TaskTypes.Task, [
      1,
      'defaultDecision',
      2,
      'parallelTasks',
      1,
    ]),
    t12: getTaskData('t12', Task.TaskTypes.Parallel, [2]),
    t13: getTaskData('t13', Task.TaskTypes.Task, [2, 'parallelTasks', 0]),
    t14: getTaskData('t14', Task.TaskTypes.Task, [2, 'parallelTasks', 1]),
  };

  test('First task finished', () => {
    expect(
      state.getNextTaskPath(exampleTasks, [0], R.pick(['t1'], mockTasksData)),
    ).toEqual({
      isCompleted: false,
      parentTask: null,
      taskPath: [1],
      isLastChild: false,
    });
  });

  test('Child of Decisions task', () => {
    expect(
      state.getNextTaskPath(
        exampleTasks,
        [1, 'decisions', 'case1', 0],
        R.pick(['t1', 't2', 't3'], mockTasksData),
      ),
    ).toEqual({
      isCompleted: false,
      parentTask: expect.objectContaining({
        taskReferenceName: 't2',
      }),
      taskPath: [1, 'decisions', 'case1', 1],
      isLastChild: false,
    });
  });

  test('Child of Decisions task (last task)', () => {
    expect(
      state.getNextTaskPath(
        exampleTasks,
        [1, 'decisions', 'case1', 1],
        R.pick(['t1', 't2', 't3', 't4'], mockTasksData),
      ),
    ).toEqual({
      isCompleted: false,
      parentTask: expect.objectContaining({
        taskReferenceName: 't2',
      }),
      taskPath: [2],
      isLastChild: true,
    });
  });

  test('Child of Decisions task (completed)', () => {
    // Excluded last task
    expect(
      state.getNextTaskPath(
        [exampleTasks[0], exampleTasks[1]],
        [1, 'decisions', 'case1', 1],
        R.pick(['t1', 't2', 't3', 't4'], mockTasksData),
      ),
    ).toEqual({
      isCompleted: true,
      parentTask: expect.objectContaining({
        taskReferenceName: 't2',
      }),
      taskPath: null,
      isLastChild: true,
    });
  });

  test('Child of Parallel (Wait)', () => {
    expect(
      state.getNextTaskPath(exampleTasks, [2, 'parallelTasks', 0, 0], {
        ...R.pick(['t1', 't2', 't3', 't4', 't12', 't13'], mockTasksData),
        t14: getTaskData(
          't14',
          Task.TaskTypes.Task,
          [2, 'parallelTasks', 1],
          State.TaskStates.Inprogress,
        ),
      }),
    ).toEqual({
      isCompleted: false,
      taskPath: null,
      parentTask: expect.objectContaining({
        taskReferenceName: 't12',
      }),
      isLastChild: false,
    });
  });

  test('Child of Parallel (All completed)', () => {
    expect(
      state.getNextTaskPath(
        exampleTasks,
        [2, 'parallelTasks', 0, 0],
        R.pick(['t1', 't2', 't3', 't4', 't12', 't13', 't14'], mockTasksData),
      ),
    ).toEqual({
      isCompleted: true,
      taskPath: null,
      parentTask: expect.objectContaining({
        taskReferenceName: 't12',
      }),
      isLastChild: true,
    });
  });
});
