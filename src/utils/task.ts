import { Task, Workflow } from '@melonade/melonade-declaration';
import { parseExpression } from 'cron-parser';
import * as _ from 'lodash/fp'; // use lodash just for "get" thing XD
import * as R from 'ramda';
import { isString } from './common';

export const getPathByInputTemplate = R.compose(
  R.split(/[[\].]/),
  R.replace(/(^\${)(.+)(}$)/i, '$2'),
);

export const mapParametersToValue = (
  parameters: { [key: string]: any },
  tasksData: { [taskReferenceName: string]: Task.ITask | Workflow.IWorkflow },
): { [key: string]: any } => {
  const parametersPairs = R.toPairs(parameters);
  const valuePairs = parametersPairs.map(
    ([key, value]: [string, string | any]): [string, any] => {
      if (isString(value)) {
        if (/^\${[a-z0-9-_.\[\]]+}$/i.test(value)) {
          return [
            key,
            _.get(value.replace(/(^\${)(.+)(}$)/i, '$2'), tasksData),
          ];
        }
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
