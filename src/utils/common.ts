import * as R from 'ramda';

export const isString = R.is(String);

export const isNumber = R.is(Number);

export const isValidName = (name: string): boolean =>
  isString(name) && /^[a-zA-Z0-9-_]{1,64}$/.test(name);

export const isValidRev = (rev: string): boolean =>
  isString(rev) && /^[a-zA-Z0-9-_]{1,64}$/.test(rev);

export const enumToList = R.compose(R.map(R.prop('1')), R.toPairs);

export const concatArray = (target: any[] = [], items: any[] | any): any[] => {
  if (R.isNil(items)) return target;
  if (R.is(Array, items)) return target.concat(items);
  return [...target, items];
};

export const jsonTryParse = <T = any>(
  jsonString: string,
  defaultValue?: T,
): T => {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return defaultValue;
  }
};

export const toObjectByKey = (targets: object[], key: string) => {
  return targets.reduce((result: object, target: object) => {
    result[target[key]] = target;
    return result;
  }, {});
};

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const appendArray = <T = any>(target: T[], data: T[] | T): T[] => {
  if (!data) {
    return target;
  }

  if (Array.isArray(data)) {
    return [...target, ...data];
  }

  return [...target, data];
};
