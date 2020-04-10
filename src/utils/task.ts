import { Task, Workflow } from '@melonade/melonade-declaration';
import { parseExpression } from 'cron-parser';
import * as jsonpath from 'jsonpath';
import * as _ from 'lodash/fp'; // use lodash just for "get" thing XD
import * as R from 'ramda';

export const getPathByInputTemplate = R.compose(
  R.split(/[[\].]/),
  R.replace(/(^\${)(.+)(}$)/i, '$2'),
);

// Support 2 types of template
const parseTemplate = (template: string, values: any) => {
  // query template
  // $.parcel[*].driverId => ["driver_1","driver_2"]
  if (/^\$\.[a-z0-9-_.\[\]]+/i.test(template)) {
    return jsonpath.query(values, template);
  }

  // get template
  // ${parcel[0].driverId} => "driver_1"
  if (/^\${[a-z0-9-_.\[\]]+}$/i.test(template)) {
    return _.get(template.replace(/(^\${)(.+)(}$)/i, '$2'), values);
  }

  return template;
};

export const mapParametersToValue = (
  parameters: any,
  tasksData: { [taskReferenceName: string]: Task.ITask | Workflow.IWorkflow },
  depth: number = 0,
): { [key: string]: any } => {
  if (depth > 4) return parameters;

  if (typeof parameters === 'object') {
    let output = Array.isArray(parameters) ? [] : {};
    for (const param in parameters) {
      output[param] = mapParametersToValue(
        parameters[param],
        tasksData,
        depth + 1,
      );
    }
    return output;
  }
  if (typeof parameters === 'string') {
    return parseTemplate(parameters, tasksData);
  }
  return parameters;
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
