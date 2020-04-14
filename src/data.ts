import Block from './block';

export const toNumber = (v: string) => {
  const n = parseFloat(v);
  return !isNaN(v as any) && !isNaN(n) ? n : null;
};
export const toIndex = (v: string) => {
  const n = toNumber(v);
  return n !== null && n === Math.floor(n) && n > 0 ? n : null;
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

export const print = ({ type, value }) => {
  if (type === 'value') {
    if (!value) return '';
    if (
      /^[a-zA-Z0-9\. ]+$/.test(value) &&
      !/^\s/.test(value) &&
      !/\s$/.test(value)
    ) {
      return value;
    }
    return `'${value.replace(/(['\\])/g, (_, m) => `\\${m}`)}'`;
  }
  return `[${value
    .toPairs()
    .filter((x) => x.value.value)
    .map(({ key, value }) => {
      if (toIndex(key.value)) return print(value);
      const [k, v] = [print(key), print(value)];
      if (!k && value.type === 'block') return `'': ${v}`;
      if (key.type === 'value' || value.type === 'value') return `${k}: ${v}`;
      return `[=> ${k}]: ${v}`;
    })
    .join(', ')}]`;
};

export const fromJs = (value) => {
  if (value === 0) return { type: 'value', value: '0' };
  if (!value) return { type: 'value', value: '' };
  if (value === true) return { type: 'value', value: 'true' };
  if (typeof value === 'number') return { type: 'value', value: `${value}` };
  if (typeof value === 'string') return { type: 'value', value };
  if (typeof value === 'function') {
    return {
      type: 'block',
      value: Block.fromFunc((create, arg) => [create(value(arg))]),
    };
  }
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return { type: 'value', value: value.toISOString() };
  }
  if (Object.prototype.toString.call(value) === '[object Object]') {
    return {
      type: 'block',
      value: Block.fromPairs(
        Object.keys(value)
          .map((k) => ({ key: fromJs(k), value: fromJs(value[k]) }))
          .filter((x) => x.value.value),
      ),
    };
  }
  if (Array.isArray(value)) {
    return {
      type: 'block',
      value: Block.fromPairs(
        value
          .map(({ key, value }) => ({ key: fromJs(key), value: fromJs(value) }))
          .filter((x) => x.value.value),
      ),
    };
  }
  return { type: 'value', value: '' };
};
