import * as CommonUtils from './common';

describe('isString', () => {
  test('String', () => {
    expect(CommonUtils.isString('ABC')).toBe(true);
    expect(CommonUtils.isString(new String('abc'))).toBe(true);
    expect(CommonUtils.isString(String('abc'))).toBe(true);
  });

  test('Not a string', () => {
    expect(CommonUtils.isString(123)).toBe(false);
    expect(CommonUtils.isString({ a: 'a' })).toBe(false);
    expect(CommonUtils.isString(['a', 'b'])).toBe(false);
    expect(CommonUtils.isString(NaN)).toBe(false);
    expect(CommonUtils.isString(undefined)).toBe(false);
  });
});

describe('isNumber', () => {
  test('Number', () => {
    expect(CommonUtils.isNumber(1)).toBe(true);
    expect(CommonUtils.isNumber(NaN)).toBe(true);
    expect(CommonUtils.isNumber(Math.PI)).toBe(true);
  });

  test('Not a number', () => {
    expect(CommonUtils.isNumber('1')).toBe(false);
    expect(CommonUtils.isNumber({})).toBe(false);
    expect(CommonUtils.isNumber([])).toBe(false);
    expect(CommonUtils.isNumber(null)).toBe(false);
    expect(CommonUtils.isNumber(undefined)).toBe(false);
  });
});

describe('isValidName', () => {
  test('empty name', () => {
    expect(CommonUtils.isValidName('')).toBe(false);
  });

  test('valid name', () => {
    expect(CommonUtils.isValidName('hello-FLOW_69')).toBe(true);
  });

  test('invalid name', () => {
    expect(CommonUtils.isValidName('hello-flow&*💩')).toBe(false);
  });

  test('too long name', () => {
    expect(
      CommonUtils.isValidName(
        'hello-flow_hello-flow_hello-flow_hello-flow_hello-flow_hello-flow_',
      ),
    ).toBe(false);
  });
});

describe('isValidRev', () => {
  test('empty rev', () => {
    expect(CommonUtils.isValidRev('')).toBe(false);
  });

  test('valid rev', () => {
    expect(CommonUtils.isValidRev('hello-FLOW_69')).toBe(true);
  });

  test('invalid rev', () => {
    expect(CommonUtils.isValidRev('hello-flow&*💩')).toBe(false);
  });

  test('too long rev', () => {
    expect(
      CommonUtils.isValidRev(
        'hello-flow_hello-flow_hello-flow_hello-flow_hello-flow_hello-flow_',
      ),
    ).toBe(false);
  });
});

describe('concatArray', () => {
  test('empty target', () => {
    expect(CommonUtils.concatArray(undefined, 'hello')).toEqual(['hello']);
  });

  test('empty items', () => {
    expect(CommonUtils.concatArray(['eiei'], undefined)).toEqual(['eiei']);
  });

  test('items array', () => {
    expect(CommonUtils.concatArray(['eiei'], ['what', 'lol'])).toEqual([
      'eiei',
      'what',
      'lol',
    ]);
  });

  test('single item', () => {
    expect(CommonUtils.concatArray(['eiei'], 'what')).toEqual(['eiei', 'what']);
  });
});

describe('jsonTryParse', () => {
  test('Valid json', () => {
    expect(CommonUtils.jsonTryParse('{"a": "b"}')).toEqual({ a: 'b' });
    expect(CommonUtils.jsonTryParse('[1,2,3]')).toEqual([1, 2, 3]);
  });

  test('Invalid json', () => {
    expect(CommonUtils.jsonTryParse('123{1"a": "b"}')).toEqual(undefined);
    expect(CommonUtils.jsonTryParse('312312[1,2,3]')).toEqual(undefined);
  });

  test('Invalid json (with default)', () => {
    expect(CommonUtils.jsonTryParse('123{1"a": "b"}', { a: 'b' })).toEqual({
      a: 'b',
    });
    expect(CommonUtils.jsonTryParse('312312[1,2,3]', { a: 'b' })).toEqual({
      a: 'b',
    });
  });
});

describe('toObjectByKey', () => {
  test('toObjectByKey', () => {
    expect(
      CommonUtils.toObjectByKey(
        [
          {
            name: 1,
            log: 1,
          },
          {
            name: 2,
            log: 2,
          },
          {
            name: 3,
            log: 3,
          },
          {
            name: 4,
            log: 4,
          },
        ],
        'name',
      ),
    ).toEqual({
      1: {
        name: 1,
        log: 1,
      },
      2: {
        name: 2,
        log: 2,
      },
      3: {
        name: 3,
        log: 3,
      },
      4: {
        name: 4,
        log: 4,
      },
    });
  });

  test('Duplicate keys', () => {
    expect(
      CommonUtils.toObjectByKey(
        [
          {
            name: 1,
            log: 1,
          },
          {
            name: 2,
            log: 2,
          },
          {
            name: 3,
            log: 3,
          },
          {
            name: 4,
            log: 4,
          },
          {
            name: 1,
            log: 123156456456413,
          },
        ],
        'name',
      ),
    ).toEqual({
      1: {
        name: 1,
        log: 123156456456413,
      },
      2: {
        name: 2,
        log: 2,
      },
      3: {
        name: 3,
        log: 3,
      },
      4: {
        name: 4,
        log: 4,
      },
    });
  });

  test('Empty', () => {
    expect(CommonUtils.toObjectByKey([], 'name')).toEqual({});
  });
});
