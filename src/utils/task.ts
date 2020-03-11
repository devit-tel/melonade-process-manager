import { Task, Workflow } from '@melonade/melonade-declaration';
import { parseExpression } from 'cron-parser';
import * as R from 'ramda';
import { isString } from './common';

export const mapParametersToValue = (
  parameters: { [key: string]: any },
  tasksData: { [taskReferenceName: string]: Task.ITask | Workflow.IWorkflow },
): { [key: string]: any } => {
  const parametersPairs = R.toPairs(parameters);
  const valuePairs = parametersPairs.map(
    ([key, value]: [string, string | any]): [string, any] => {
      if (
        isString(value) &&
        /^\${[a-z0-9-_]{1,64}[a-z0-9-_.]+}$/i.test(value)
      ) {
        return [
          key,
          R.path(value.replace(/(^\${)(.+)(}$)/i, '$2').split('.'), tasksData),
        ];
      }
      return [key, value];
    },
  );
  return R.fromPairs(valuePairs);
};

export const getCompltedAt = (task: Task.ITask): number => {
  try {
    const completedAfter = R.path(['input', 'completedAfter'], task) as number;
    if (Number.isFinite(completedAfter)) {
      return Date.now() + completedAfter;
    }
    const completedAt = new Date(R.path(['input', 'completedAt'], task));
    if (!Number.isNaN(completedAt.getTime())) {
      return completedAt.getTime();
    }

    return parseExpression(R.path(['input', 'completedWhen'], task))
      .next()
      .getTime();
  } catch (error) {
    console.log(error);
    return 0;
  }
};
