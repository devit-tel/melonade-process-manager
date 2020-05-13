import { State, Task } from '@melonade/melonade-declaration';
import * as task from './task';

describe('mapParametersToValue', () => {
  test('Parse parameter', () => {
    expect(
      task.mapParametersToValue(
        {
          a: '${t1.output.a}',
          b: 'hardcoded',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 'eiei',
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      a: 'eiei',
      b: 'hardcoded',
    });
  });

  test(`Parse nested`, () => {
    expect(
      task.mapParametersToValue(
        {
          a: '${t1.output.a}',
          b: 'hardcoded',
          nested: {
            c: '${t1.output.a}',
            level2: {
              level3: {
                eiei: '${t1.output.a}',
                eiei2: '$.t1.output[*]',
                level4: {
                  eiei: '${t1.output.a}',
                  eiei2: '$.t1.output[*]',
                  level5: {
                    level6: {
                      level7: {
                        eiei: '${t1.output.a}',
                        eiei2: '$.t1.output[*]',
                      },
                    },
                  },
                },
              },
            },
          },
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 'eiei',
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      a: 'eiei',
      b: 'hardcoded',
      nested: {
        c: 'eiei',
        level2: {
          level3: {
            eiei: 'eiei',
            eiei2: ['eiei'],
            level4: {
              eiei: '${t1.output.a}',
              eiei2: '$.t1.output[*]',
              level5: {
                level6: {
                  level7: {
                    eiei: '${t1.output.a}',
                    eiei2: '$.t1.output[*]',
                  },
                },
              },
            },
          },
        },
      },
    });
  });

  test(`Array`, () => {
    const TASKS_DATA = {
      t1: {
        taskName: 'taskName',
        taskReferenceName: 't1',
        taskId: 'taskId',
        workflowId: 'workflowId',
        transactionId: 'transactionId',
        type: Task.TaskTypes.Task,
        status: State.TaskStates.Completed,
        output: {
          a: 'eiei',
          b: [
            {
              c: 'hello',
            },
          ],
        },
        input: {},
        ackTimeout: 0,
        createTime: 0,
        endTime: 0,
        logs: [],
        retries: 0,
        isRetried: false,
        retryDelay: 0,
        timeout: 0,
        startTime: 0,
        taskPath: [0],
      },
    };

    expect(
      task.mapParametersToValue(
        {
          x: '${t1.output.b.0.c}',
          b: 'hardcoded',
        },
        TASKS_DATA,
      ),
    ).toEqual({
      x: 'hello',
      b: 'hardcoded',
    });

    expect(
      task.mapParametersToValue(
        {
          x: '${t1.output.b[0]c}',
          b: 'hardcoded',
        },
        TASKS_DATA,
      ),
    ).toEqual({
      x: 'hello',
      b: 'hardcoded',
    });
  });

  test(`JSON Path simple query`, () => {
    const TASKS_DATA = {
      t1: {
        taskName: 't11',
        taskReferenceName: 't1',
        taskId: 't_ID',
        workflowId: 'w_ID',
        transactionId: 'tr_ID',
        type: Task.TaskTypes.Task,
        status: State.TaskStates.Completed,
        output: {
          a: 'eiei',
          b: [
            {
              c: 'hello',
            },
          ],
        },
        input: {},
        ackTimeout: 0,
        createTime: 0,
        endTime: 0,
        logs: [],
        retries: 0,
        isRetried: false,
        retryDelay: 0,
        timeout: 0,
        startTime: 0,
        taskPath: [0],
      },
    };

    expect(
      task.mapParametersToValue(
        {
          x: '$.t1[*]',
        },
        TASKS_DATA,
      ),
    ).toEqual({
      x: [
        't11',
        't1',
        't_ID',
        'w_ID',
        'tr_ID',
        'TASK',
        'COMPLETED',
        {
          a: 'eiei',
          b: [
            {
              c: 'hello',
            },
          ],
        },
        {},
        0,
        0,
        0,
        [],
        0,
        false,
        0,
        0,
        0,
        [0],
      ],
    });

    expect(
      task.mapParametersToValue(
        {
          x: '$..c',
        },
        TASKS_DATA,
      ),
    ).toEqual({
      x: ['hello'],
    });
  });

  test(`JSON Path 2`, () => {
    const TASKS_DATA = {
      t1: {
        taskName: 't11',
        taskReferenceName: 't1',
        taskId: 't_ID',
        workflowId: 'w_ID',
        transactionId: 'tr_ID',
        type: Task.TaskTypes.Task,
        status: State.TaskStates.Completed,
        output: {
          book: [
            {
              category: 'reference',
              author: 'Nigel Rees',
              title: 'Sayings of the Century',
              price: 8.95,
            },
            {
              category: 'fiction',
              author: 'Evelyn Waugh',
              title: 'Sword of Honour',
              price: 12.99,
            },
            {
              category: 'fiction',
              author: 'Herman Melville',
              title: 'Moby Dick',
              isbn: '0-553-21311-3',
              price: 8.99,
            },
            {
              category: 'fiction',
              author: 'J. R. R. Tolkien',
              title: 'The Lord of the Rings',
              isbn: '0-395-19395-8',
              price: 22.99,
            },
          ],
          bicycle: {
            color: 'red',
            price: 19.95,
          },
        },
        input: {},
        ackTimeout: 0,
        createTime: 0,
        endTime: 0,
        logs: [],
        retries: 0,
        isRetried: false,
        retryDelay: 0,
        timeout: 0,
        startTime: 0,
        taskPath: [0],
      },
    };

    expect(
      task.mapParametersToValue(
        {
          titles: '$.t1.output.book.*.title',
        },
        TASKS_DATA,
      ),
    ).toEqual({
      titles: [
        'Sayings of the Century',
        'Sword of Honour',
        'Moby Dick',
        'The Lord of the Rings',
      ],
    });
  });



  test('Parameter is number', () => {
    expect(
      task.mapParametersToValue(
        1,
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 'eiei',
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual(1);
  });

  test('Append const string', () => {
    expect(
      task.mapParametersToValue(
        {
          a: '${\'Takumi\' + \' \' + \'Producer\'}',
          b: 'hardcoded',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 'eiei',
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      a: 'Takumi Producer',
      b: 'hardcoded',
    });
  });

  test('Single const string', () => {
    expect(
      task.mapParametersToValue(
        {
          a: '${\'Takumi\'}',
          b: 'hardcoded',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 'eiei',
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      a: 'Takumi',
      b: 'hardcoded',
    });
  });

  test('Input c = a + b and store in c shoud have number 7', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} + ${t1.output.b}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 5,
              b: 7,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: 12,
    });
  });

  test('Input c = a - b and store in c shoud have number -2', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} - ${t1.output.b}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 5,
              b: 7,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: -2,
    });
  });

  test('Input c = a * b and store in c shoud have number 35', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} * ${t1.output.b}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 5,
              b: 7,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: 35,
    });
  });

  test('Input c = a / b and store in c shoud have number 2.5', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} / ${t1.output.b}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 5,
              b: 2,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: 2.5,
    });
  });

  test('Input c = a ^ b and store in c shoud have number 64', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} ^ ${t1.output.b}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 4,
              b: 3,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: 64,
    });
  });

  test('Input c = a + b but b was a string and store in c shoud have string 57', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} + ${t1.output.b}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 5,
              b: '7',
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: '57',
    });
  });

  test('Input c = a + b * 2 should and c shoud have 19', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} + ${t1.output.b} * 2}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 5,
              b: 7,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: 19,
    });
  });

  test('Input a not equal b and c is == the result should be false', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} == ${t1.output.b}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 5,
              b: 7,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: false,
    });
  });

  test('Input a is equal b and c is a == b the result should be true', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} == ${t1.output.b}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 5,
              b: 5,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: true,
    });
  });


  test('Input a not equal b and c is != the result should be true', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} != ${t1.output.b}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 5,
              b: 7,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: true,
    });
  });

  test('Input a is equal b and c is a != b the result should be false', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} != ${t1.output.b}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 5,
              b: 5,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: false,
    });
  });

  test('Input a is equal b and c is a > b the result should be false', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} > ${t1.output.b}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 5,
              b: 5,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: false,
    });
  });

  test('Input a is greater than b and c is a > b the result should be true', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} > ${t1.output.b}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 7,
              b: 5,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: true,
    });
  });

  test('Input a is less than b and c is a > b the result should be false', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} > ${t1.output.b}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 5,
              b: 7,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: false,
    });
  });


  test('Input a is equal b and c is a < b the result should be false', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} < ${t1.output.b}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 5,
              b: 5,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: false,
    });
  });

  test('Input a is greater than b and c is a < b the result should be false', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} < ${t1.output.b}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 7,
              b: 5,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: false,
    });
  });

  test('Input a is less than b and c is a < b the result should be true', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} < ${t1.output.b}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 5,
              b: 7,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: true,
    });
  });

  test('Input a is equal b and c is a >= b the result should be true', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} >= ${t1.output.b}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 5,
              b: 5,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: true,
    });
  });

  test('Input a is greater than b and c is a >= b the result should be true', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} >= ${t1.output.b}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 7,
              b: 5,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: true,
    });
  });

  test('Input a is less than b and c is a >= b the result should be false', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} >= ${t1.output.b}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 5,
              b: 7,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: false,
    });
  });


  test('Input a is equal b and c is a <= b the result should be true', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} <= ${t1.output.b}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 5,
              b: 5,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: true,
    });
  });

  test('Input a is greater than b and c is a <= b the result should be false', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} <= ${t1.output.b}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 7,
              b: 5,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: false,
    });
  });

  test('Input a is less than b and c is a <= b the result should be true', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} <= ${t1.output.b}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 5,
              b: 7,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: true,
    });
  });

  test('Input a is less than b and c is a <= b the result should be true', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} <= ${t1.output.b}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 5,
              b: 7,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: true,
    });
  });

  test('Input a and b is true do And function c should have true ', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} && ${t1.output.b}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: true,
              b: true,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: true,
    });
  });

  test('Input a is true b is false do And function c should have false ', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} && ${t1.output.b}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: true,
              b: false,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: false,
    });
  });

  test('Input a and b is false do And function c should have false ', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} && ${t1.output.b}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: false,
              b: false,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: false,
    });
  });

  test('Input a and b is true do OR function c should have true ', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} || ${t1.output.b}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: true,
              b: true,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: true,
    });
  });

  test('Input a is false b is true do OR function c should have true ', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} || ${t1.output.b}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: false,
              b: true,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: true,
    });
  });

  test('Input a is false b is false do OR function c should have false ', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} || ${t1.output.b}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: false,
              b: false,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: false,
    });
  });

  test('Input a + b should equal b + a and c should be true', () => {
    expect(
      task.mapParametersToValue(
        {
          c: '${${t1.output.a} + ${t1.output.b} == ${t1.output.b} + ${t1.output.a}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 5,
              b: 7,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      c: true,
    });
  });

  test('Input a + b * c should do b * c first and d should be 75', () => {
    expect(
      task.mapParametersToValue(
        {
          d: '${${t1.output.a} + ${t1.output.b} * ${t1.output.c}}',
        },
        {
          t1: {
            taskName: 'taskName',
            taskReferenceName: 't1',
            taskId: 'taskId',
            workflowId: 'workflowId',
            transactionId: 'transactionId',
            type: Task.TaskTypes.Task,
            status: State.TaskStates.Completed,
            output: {
              a: 5,
              b: 7,
              c: 10,
            },
            input: {},
            ackTimeout: 0,
            createTime: 0,
            endTime: 0,
            logs: [],
            retries: 0,
            isRetried: false,
            retryDelay: 0,
            timeout: 0,
            startTime: 0,
            taskPath: [0],
          },
        },
      ),
    ).toEqual({
      d: 75,
    });
  });
});
