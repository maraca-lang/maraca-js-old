import { createBlock, fromObj } from './block';

export const keysToObject = (
  keys,
  valueMap,
  keyMap = (k, _) => k,
  initial = {},
) =>
  keys.reduce((res, k, i) => {
    const value = valueMap(k, i);
    if (value === undefined) return res;
    return { ...res, [keyMap(k, i)]: value };
  }, initial);

export const toNumber = (v: string) => {
  const n = parseFloat(v);
  return !isNaN(v as any) && !isNaN(n) ? n : null;
};
export const toIndex = (v: string) => {
  const n = toNumber(v);
  return n !== null && n === Math.floor(n) && n > 0 ? n : null;
};

const sortMultiple = <T = any>(
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

const tryNumber = (s) => {
  const n = parseFloat(s);
  return !isNaN(s) && !isNaN(n) ? n : s;
};
const getMinus = (v) => {
  if (!v) return { minus: false, v };
  const minus = typeof v === 'number' ? v < 0 : v[0] === '-';
  if (!minus) return { minus, value: v };
  return { minus, value: typeof v === 'number' ? -v : v.slice(1) };
};
const sortStrings = (s1, s2): -1 | 0 | 1 => {
  if (s1 === s2) return 0;
  const n1 = tryNumber(s1);
  const n2 = tryNumber(s2);
  const m1 = getMinus(n1);
  const m2 = getMinus(n2);
  if (m1.minus !== m2.minus) return m1.minus ? -1 : 1;
  const dir = m1.minus ? -1 : 1;
  const t1 = typeof m1.value;
  const t2 = typeof m2.value;
  if (t1 === t2) {
    if (t1 === 'string') {
      return (dir * m1.value.localeCompare(m2.value)) as -1 | 0 | 1;
    }
    return (dir * (m1.value < m2.value ? -1 : 1)) as -1 | 0 | 1;
  }
  return (dir * (t1 === 'number' ? -1 : 1)) as -1 | 0 | 1;
};
export const compare = (v1, v2): -1 | 0 | 1 => {
  const type1 = v1.value ? v1.type : 'nil';
  const type2 = v2.value ? v2.type : 'nil';
  if (type1 !== type2) {
    return type1 === 'nil' || type2 === 'block' ? -1 : 1;
  }
  if (type1 === 'nil') return 0;
  if (type1 === 'value') return sortStrings(v1.value, v2.value);
  const keys = Array.from(
    new Set([...Object.keys(v1.value.values), ...Object.keys(v2.value.values)]),
  ).sort((a, b) =>
    compare(
      (v1.value.values[a] || (v2 as any).value.values[a]).key,
      (v1.value.values[b] || (v2 as any).value.values[b]).key,
    ),
  );
  return sortMultiple(
    keys.map(
      (k) =>
        (v1.value.values[k] && v1.value.values[k].value) || {
          type: 'value',
          value: '',
        },
    ),
    keys.map(
      (k) =>
        (v2.value.values[k] && v2.value.values[k].value) || {
          type: 'value',
          value: '',
        },
    ),
    compare,
  );
};

export const printValue = (value) => {
  if (!value) return '';
  if (
    /^[a-zA-Z0-9\. ]+$/.test(value) &&
    !/^\s/.test(value) &&
    !/\s$/.test(value)
  ) {
    return value;
  }
  return `'${value.replace(/(['\\])/g, (_, m) => `\\${m}`)}'`;
};

export const fromJs = (value, arrayPairs = false) => {
  if (value === 0) return { type: 'value', value: '0' };
  if (!value) return { type: 'value', value: '' };
  if (value === true) return { type: 'value', value: 'true' };
  if (typeof value === 'number') return { type: 'value', value: `${value}` };
  if (typeof value === 'string') return { type: 'value', value };
  if (typeof value === 'function') {
    const result = createBlock();
    result.func = (create, arg) => ({
      type: 'stream',
      value: create(value(arg)),
    });
    return { type: 'block', value: result };
  }
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return { type: 'value', value: value.toISOString() };
  }
  if (Object.prototype.toString.call(value) === '[object Object]') {
    return {
      type: 'block',
      value: fromObj(keysToObject(Object.keys(value), (k) => fromJs(value[k]))),
    };
  }
  if (Array.isArray(value)) {
    return {
      type: 'block',
      value: fromObj(
        keysToObject(
          value,
          (x) => fromJs(arrayPairs ? x.value : x),
          (x, i) => (arrayPairs ? x.key : i + 1),
        ),
      ),
    };
  }
  return { type: 'value', value: '' };
};

export const toJs = (data = { type: 'value', value: '' } as any, config) => {
  if (!config) return undefined;
  if (config === true) return data;
  if (typeof config === 'function') {
    return { value: toJs(data, config()), push: data.push };
  }
  if (!data.value) return undefined;
  if (config === 'boolean') return true;
  if (Array.isArray(config) && config.length > 1) {
    for (const c of config) {
      const v = toJs(data, c);
      if (v) return v;
    }
    return undefined;
  }
  if (data.type === 'value') {
    if (config === 'string') return data.value;
    if (config === 'number') {
      const result = toNumber(data.value);
      return result === null ? undefined : result;
    }
    if (config === 'integer') {
      const result = toIndex(data.value);
      return result === null ? undefined : result;
    }
    return undefined;
  }
  if (typeof config === 'object') {
    const indices = data.value.indices;
    const values = keysToObject(
      Object.keys(data.value.values),
      (k) => data.value.values[k].value,
      (k) =>
        k.startsWith("'")
          ? k.slice(1, -1).replace(/\\([\s\S])/g, (_, m) => m)
          : k,
    );
    if (Array.isArray(config)) {
      return indices.map((d, i) => toJs(d, config[i % config.length]));
    }
    const allValues = keysToObject(
      indices,
      (d) => d,
      (_, i) => i + 1,
      values,
    );
    const keys =
      config['*'] || config['**']
        ? Array.from(
            new Set([
              ...Object.keys(config['**'] ? allValues : values),
              ...Object.keys(config),
            ]),
          )
        : Object.keys(config);
    return keysToObject(
      keys.filter((k) => !(k === '*' || k === '**')),
      (k) => toJs(allValues[k], config[k] || config['*'] || config['**']),
    );
  }
  return undefined;
};
