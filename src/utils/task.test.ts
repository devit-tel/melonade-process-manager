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

  test('String append', () => {
    expect(
      task.mapParametersToValue(
        {
          c:
            '${t1.output.driverName} กรุณาขับรถไปที่ ${t1.output.pickupLocation} เพื่อสั่ง ${t1.output.order} เพิ่ม ${t1.output.additions} ด้วยนะ',
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
              driverName: 'Prayoooooot',
              pickupLocation: 'ข้าวมันไก่ป้าดา',
              order: 'ข้าวผัด',
              additions: 'ไข่ดาว',
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
      c:
        'Prayoooooot กรุณาขับรถไปที่ ข้าวมันไก่ป้าดา เพื่อสั่ง ข้าวผัด เพิ่ม ไข่ดาว ด้วยนะ',
    });
  });

  test('Basic add test', () => {
    expect(
      task.mapParametersToValue(
        {
          c: 'math(${t1.output.a} + ${t1.output.b})',
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
              a: 1,
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
      c: 3,
    });
  });

  test('Basic subtract test', () => {
    expect(
      task.mapParametersToValue(
        {
          c: 'math(${t1.output.a} - ${t1.output.b})',
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
              a: 1,
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
      c: -1,
    });
  });

  test('Basic multiply test', () => {
    expect(
      task.mapParametersToValue(
        {
          c: 'math(${t1.output.a} * ${t1.output.b})',
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
      c: 8,
    });
  });

  test('Basic divide test', () => {
    expect(
      task.mapParametersToValue(
        {
          c: 'math(${t1.output.a} / ${t1.output.b})',
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
              a: 16,
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
      c: 8,
    });
  });

  test('Basic power test', () => {
    expect(
      task.mapParametersToValue(
        {
          c: 'math(${t1.output.a} ^ ${t1.output.b})',
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
              a: 2,
              b: 8,
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
      c: 256,
    });
  });

  test('Parentheses test', () => {
    expect(
      task.mapParametersToValue(
        {
          c: 'math(${t1.output.a} + (${t1.output.b} - ${t1.output.a}))',
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
              a: 2,
              b: 8,
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
      c: 8,
    });
  });

  test('Compare test', () => {
    expect(
      task.mapParametersToValue(
        {
          c: 'math(${t1.output.a} + ${t1.output.b} != ${t1.output.a})',
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
              a: 2,
              b: 8,
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

  test('Logical and test', () => {
    expect(
      task.mapParametersToValue(
        {
          c:
            'math(${t1.output.a} == ${t1.output.b} && ${t1.output.a} == ${t1.output.b})',
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
              a: 2,
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
      c: true,
    });
  });

  test('Logical or test', () => {
    expect(
      task.mapParametersToValue(
        {
          c:
            'math(${t1.output.b} == ${t1.output.b} || ${t1.output.a} == ${t1.output.b})',
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
              a: 2,
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

  test('Math error test', () => {
    expect(
      task.mapParametersToValue(
        {
          c: 'math(x+x)',
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
              a: 2,
              b: 8,
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
      c: 'x+x',
    });
  });

  test('Date parse test', () => {
    expect(
      task.mapParametersToValue(
        {
          c: 'date(${t1.output.a})',
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
              a: '2019/05/13 04:35:01Z',
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
      c: 1557722101000, //UTC Timezone
    });
  });

  test('Datetime incorrect will result in NaN', () => {
    expect(
      task.mapParametersToValue(
        {
          c: 'date(${t1.output.a})',
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
              a: '-------------',
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
      c: NaN,
    });
  });

  test('Date from now', () => {
    expect(
      task.mapParametersToValue('fromNow(${t1.output.a})', {
        t1: {
          taskName: 'taskName',
          taskReferenceName: 't1',
          taskId: 'taskId',
          workflowId: 'workflowId',
          transactionId: 'transactionId',
          type: Task.TaskTypes.Task,
          status: State.TaskStates.Completed,
          output: {
            a: new Date().toString(),
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
      }),
    ).toBeLessThanOrEqual(0);
  });
});
