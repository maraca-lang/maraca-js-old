import { createBlock, fromPairs, toPairs } from './block';
import { sortMultiple } from './misc';

export const toNumber = (v: string) => {
  const n = parseFloat(v);
  return !isNaN(v as any) && !isNaN(n) ? n : null;
};
export const toIndex = (v: string) => {
  const n = toNumber(v);
  return n !== null && n === Math.floor(n) && n > 0 ? n : null;
};

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
  return `[${toPairs(value)
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

export const fromJs = (value, arrayPairs = false) => {
  if (value === 0) return { type: 'value', value: '0' };
  if (!value) return { type: 'value', value: '' };
  if (value === true) return { type: 'value', value: 'true' };
  if (typeof value === 'number') return { type: 'value', value: `${value}` };
  if (typeof value === 'string') return { type: 'value', value };
  if (typeof value === 'function') {
    const result = createBlock();
    result.func = (create, arg) => [
      { type: 'stream', value: create(value(arg)) },
    ];
    return { type: 'block', value: result };
  }
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return { type: 'value', value: value.toISOString() };
  }
  if (Object.prototype.toString.call(value) === '[object Object]') {
    return {
      type: 'block',
      value: fromPairs(
        Object.keys(value)
          .map((k) => ({ key: fromJs(k), value: fromJs(value[k]) }))
          .filter((x) => x.value.value),
      ),
    };
  }
  if (Array.isArray(value)) {
    return {
      type: 'block',
      value: fromPairs(
        value
          .map((x, i) => {
            if (!arrayPairs) return { key: fromJs(i + 1), value: fromJs(x) };
            return { key: fromJs(x.key), value: fromJs(x.value) };
          })
          .filter((x) => x.value.value),
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
    const values = Object.keys(data.value.values).reduce((res, k) => {
      const key = k.startsWith("'")
        ? k.slice(1, -1).replace(/\\([\s\S])/g, (_, m) => m)
        : k;
      return { ...res, [key]: data.value.values[k].value };
    }, {});
    if (Array.isArray(config)) {
      return indices.map((d, i) => toJs(d, config[i % config.length]));
    }
    const allValues = indices.reduce(
      (res, d, i) => ({ ...res, [i + 1]: d }),
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
    return keys.reduce((res, k) => {
      if (k === '*' || k === '**') return res;
      const v = toJs(allValues[k], config[k] || config['*'] || config['**']);
      return v ? { ...res, [k]: v } : res;
    }, {});
  }
  return undefined;
};
