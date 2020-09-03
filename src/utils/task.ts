import { Task, Workflow } from '@melonade/melonade-declaration';
import { parseExpression } from 'cron-parser';
import { Parser } from 'expr-eval';
import * as jsonpath from 'jsonpath';
import * as _ from 'lodash/fp'; // use lodash just for "get" thing XD
import * as R from 'ramda';

export const getPathByInputTemplate = R.compose(
  R.split(/[[\].]/),
  R.replace(/(^\${)(.+)(}$)/i, '$2'),
);

const resolveVars = (expression: string, values: any) => {
  const variables = expression.match(/\${[a-z0-9-_.\[\]]+}/gi);
  if (variables) {
    variables.forEach((element) => {
      expression = expression.replace(
        element,
        _.get(element.replace(/(^\${)(.+)(}$)/i, '$2'), values),
      );
    });
  }
  return expression;
};

const dateParse = (expression: string, values: any) => {
  try {
    expression = resolveVars(expression, values);
    return Date.parse(expression);
  } catch (error) {
    return expression;
  }
};

const mathCalculation = (expression: string, values: any) => {
  try {
    expression = resolveVars(expression, values);
    const parser = new Parser({
      operators: {
        add: true,
        concatenate: true,
        conditional: true,
        divide: true,
        factorial: true,
        multiply: true,
        power: true,
        remainder: true,
        subtract: true,
        logical: true,
        comparison: true,
        // Disable 'in' and = operators
        in: false,
        assignment: false,
      },
    });

    expression = expression.replace(/\&\&/g, ' and ');
    expression = expression.replace(/\|\|/g, ' or ');

    const expr = parser.parse(expression);
    return expr.evaluate();
  } catch (error) {
    return expression;
  }
};

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

  // math template
  // math(2+2) => 4
  if (/(^math\()(.+)(\)$)/i.test(template)) {
    return mathCalculation(
      template.replace(/(^math\()(.+)(\)$)/i, '$2'),
      values,
    );
  }

  // date conversion template
  // date('2019/05/13 04:35:01') => 1557696901000
  if (/(^date\()(.+)(\)$)/i.test(template)) {
    return dateParse(template.replace(/(^date\()(.+)(\)$)/i, '$2'), values);
  }

  const dateFromNowMatch = /(^fromNow\()(.+)(\)$)/i.exec(template);
  if (dateFromNowMatch?.length) {
    return Math.max(+dateParse(dateFromNowMatch[2], values) - Date.now(), 100);
  }

  // string append template
  // ${parcel[0].driverId} ${parcel[0].driverId} => "driver_1 driver_1"
  if (/\${[a-z0-9-_.\[\]]+}/gi.test(template)) {
    return resolveVars(template, values);
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
    return 0;
  }
};
