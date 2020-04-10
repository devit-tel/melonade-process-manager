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

  test(`Won't parse nested`, () => {
    expect(
      task.mapParametersToValue(
        {
          a: '${t1.output.a}',
          b: 'hardcoded',
          nested: {
            c: '${t1.output.a}',
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
        c: '${t1.output.a}',
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
});
