import { Task, Workflow } from '@melonade/melonade-declaration';
import { parseExpression } from 'cron-parser';
import * as jsonpath from 'jsonpath';
import * as _ from 'lodash/fp'; // use lodash just for "get" thing XD
import * as R from 'ramda';

export const getPathByInputTemplate = R.compose(
  R.split(/[[\].]/),
  R.replace(/(^\${)(.+)(}$)/i, '$2'),
);

const expressionOperators = {
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
};


const solveRegExp = [ // Order by operator priority
  /\&\&|\|\|/g, 
  /==|!=|>=|<=|>|</g, 
  /\+|\-/g, 
  /\*|\//g, 
];



const solveExpression = (expression: string, values: any, depth: number = 0) => {

  if (depth == solveRegExp.length) { // No more operator to solve just resolve variable
    const trimmedExpression = expression.trim();
    if (/^\d+$/.test(trimmedExpression)) { // Check if it's number
      return parseInt(trimmedExpression);
    }

    if (/^\${[a-z0-9-_.\[\]]+}$/i.test(trimmedExpression)) { // Check if it's variable
      return _.get(trimmedExpression.replace(/(^\${)(.+)(}$)/i, '$2'), values);
    }
    return expression; //Assume it's string Do not trim the string
  }

  const matchRegExp = solveRegExp[depth];
  const operators = expression.match(matchRegExp);
  const operands = expression.replace(matchRegExp, "&&").split("&&"); // Replace everything to && to split it properly
  if (operators) {
    if (
      operators.length > 0 &&
      operands.length > 0 &&
      operators.length == (operands.length - 1)
    ) {
      let result = solveExpression(operands[0], values, depth + 1);
      for (let i = 0; i < operators.length; i++) {
        let nextOperand = solveExpression(operands[i + 1], values, depth + 1);
        result = expressionOperators[operators[i].trim()](result, nextOperand);
      }
      return result;
    } else {
      return expression;
    }
  } else {
    return solveExpression(expression, values, depth + 1);
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
  // ${${parcel[0].driverId} == ${parcel[0].driverId}}
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
