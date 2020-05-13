import { Task, Workflow } from '@melonade/melonade-declaration';
import { parseExpression } from 'cron-parser';
import * as jsonpath from 'jsonpath';
import * as _ from 'lodash/fp'; // use lodash just for "get" thing XD
import * as R from 'ramda';

export const getPathByInputTemplate = R.compose(
  R.split(/[[\].]/),
  R.replace(/(^\${)(.+)(}$)/i, '$2'),
);

const calculate = {
  '==': (a: any, b: any) => { return a == b },
  '!=': (a: any, b: any) => { return a != b },
  '<': (a: any, b: any) => { return a < b },
  '>': (a: any, b: any) => { return a > b },
  '<=': (a: any, b: any) => { return a <= b },
  '>=': (a: any, b: any) => { return a >= b },
  '&&': (a: any, b: any) => { return a && b },
  '||': (a: any, b: any) => { return a || b },
  '+': (a: any, b: any) => { return a + b },
  '-': (a: any, b: any) => { return a - b },
  '*': (a: any, b: any) => { return a * b },
  '/': (a: any, b: any) => { return a / b },
  '^': (a: any, b: any) => { return Math.pow(a, b) },
};


const solveRegExp = [ // Order by operator priority
  /(\&\&|\|\|)/g,
  /(==|!=|>=|<=|>|<)/g,
  /(\+|\-)/g,
  /(\*|\/|\^)/g,
];

const solveExpression = (expression: string, values: any, depth: number = 0) => {

  if (depth == solveRegExp.length) { // No more operator to solve just resolve variable
    expression = expression.trim();
    if (/^\d+$/.test(expression)) { // Check if it's number
      return parseInt(expression);
    }

    if (/^\${[a-z0-9-_.\[\]]+}$/i.test(expression)) { // Check if it's variable
      return _.get(expression.replace(/(^\${)(.+)(}$)/i, '$2'), values);
    }

    if (/(^\')(.+)(\'$)/i.test(expression)) {
      return expression.replace(/(^\')(.+)(\'$)/i, '$2');
    }

    return "";
  }

  const matchRegExp = solveRegExp[depth];
  const ops = expression.split(matchRegExp);
  if (ops.length > 2) {
    let accum = solveExpression(ops.shift(), values, depth + 1);
    while (ops.length > 1) {
      let operator = calculate[ops.shift()];
      let operand = solveExpression(ops.shift(), values, depth + 1);
      if (operator) {
        accum = operator(accum, operand);
      }
    }
    return accum;

  } else {
    return solveExpression(ops[0], values, depth + 1);
  }
}

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

  // expression template
  // ${${parcel[0].driverId} == ${parcel[0].driverId} => true/false
  // ${${parcel[0].driverId} == 'A1'} => true/false
  // ${${parcel[0].driverId} + ${parcel[0].driverId}} => 6
  // ${${parcel[0].driverId} + 1} => 4
  // ${'Hello' + 'World'} => 'HelloWorld'
  if (/(^\${)(.+)(}$)/i.test(template)) {
    return solveExpression(template.replace(/(^\${)(.+)(}$)/i, '$2'), values);
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
