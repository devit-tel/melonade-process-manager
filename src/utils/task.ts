import { Task, Workflow } from '@melonade/melonade-declaration';
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
