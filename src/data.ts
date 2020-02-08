import Box from './box';

export const fromJsFunc = (arg, func, deep) => (set, get) => {
  const run = func(set);
  return dispose => (dispose ? run() : run(get(arg, deep)));
};

export const fromJs = value => {
  if (value === 0) return { type: 'value', value: '0' };
  if (!value) return { type: 'value', value: '' };
  if (value === true) return { type: 'value', value: 'true' };
  if (typeof value === 'number') return { type: 'value', value: `${value}` };
  if (typeof value === 'string') return { type: 'value', value };
  if (typeof value === 'function') {
    return {
      type: 'box',
      value: Box.fromFunc((create, arg) => [
        create(fromJsFunc(arg, value, true)),
      ]),
    };
  }
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return { type: 'value', value: value.toISOString() };
  }
  if (Object.prototype.toString.call(value) === '[object Object]') {
    return {
      type: 'box',
      value: Box.fromPairs(
        Object.keys(value).map(k => ({
          key: fromJs(k),
          value: fromJs(value[k]),
        })),
      ),
    };
  }
  if (Array.isArray(value)) {
    return {
      type: 'box',
      value: Box.fromPairs(
        value.map(({ key, value }) => ({
          key: fromJs(key),
          value: fromJs(value),
        })),
      ),
    };
  }
  return { type: 'value', value: '' };
};

const dateRegex = /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)/;
export const toJs = data => {
  if (!data.value) return null;
  if (data.type === 'value') {
    const s = data.value;
    if (!isNaN(s as any) && !isNaN(parseFloat(s))) return parseFloat(s);
    if (dateRegex.test(s)) return new Date(s);
    return s;
  }
  return data
    .toPairs()
    .filter(({ value }) => value.value)
    .map(({ key, value }) => ({ key: toJs(key), value: toJs(value) }));
};

export const isEqual = (v1, v2) => {
  if (v1.type !== v2.type) return false;
  if (v1.type !== 'box') return v1.value === v2.value;
  const fullObj1 = v1.toObject();
  const fullObj2 = v2.toObject();
  const obj1 = Object.keys(fullObj1).reduce(
    (res, k) => (!fullObj1[k].value ? res : { ...res, [k]: fullObj1[k] }),
    {},
  );
  const obj2 = Object.keys(fullObj2).reduce(
    (res, k) => (!fullObj2[k].value ? res : { ...res, [k]: fullObj2[k] }),
    {},
  );
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) return false;
  return keys1.every(k => obj2[k] && isEqual(obj1[k].value, obj2[k].value));
};

export const toIndex = (v: string) => {
  const n = parseFloat(v);
  return !isNaN(v as any) && !isNaN(n) && n === Math.floor(n) && n > 0 && n;
};

export const sortMultiple = <T = any>(
  items1: T[],
  items2: T[],
  sortItems: (a: T, b: T) => number,
  reverseUndef = false,
) =>
  Array.from({ length: Math.max(items1.length, items2.length) }).reduce(
    (res, _, i) => {
      if (res !== 0) return res;
      if (items1[i] === undefined) return reverseUndef ? 1 : -1;
      if (items2[i] === undefined) return reverseUndef ? -1 : 1;
      return sortItems(items1[i], items2[i]);
    },
    0,
  ) as -1 | 0 | 1;
