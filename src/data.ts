import * as chrono from 'chrono-node';

export const toData = value => {
  if (!value) return { type: 'nil' };
  if (value === true) return { type: 'string', value: '1' };
  if (typeof value === 'number') return { type: 'string', value: `${value}` };
  if (typeof value === 'string') return { type: 'string', value };
  return { type: 'list', value };
};

export const stringToValue = s =>
  !isNaN(s) && !isNaN(parseFloat(s)) ? parseFloat(s) : s;

export const toJs = data => {
  if (data.type === 'nil') return null;
  if (data.type === 'string') return stringToValue(data.value);
  const keys = Object.keys(data.value.values);
  const result = keys.every(k => {
    const n = stringToValue(k);
    return typeof n === 'number' && Math.floor(n) === n;
  })
    ? []
    : {};
  keys.forEach(k => (result[k] = toJs(data.value.values[k])));
  return result;
};

export const toNumber = ({ type, value }) => {
  if (type === 'nil') return 0;
  if (type === 'string') {
    const v = stringToValue(value);
    return typeof v === 'number' ? v : null;
  }
  return null;
};

export const toInteger = data => {
  const n = toNumber(data);
  return n && Math.floor(n) === n ? n : null;
};

export const toString = ({ type, value }) => {
  if (type === 'nil') return '';
  if (type === 'string') return value;
  return null;
};

export const toDateData = ({ type, value }) => {
  if (type !== 'string') return { type: 'nil' };
  const date = chrono.parseDate(value, new Date(), { forwardDate: true });
  return date ? { type: 'string', value: date.toISOString() } : { type: 'nil' };
};

const stringToNatural = s =>
  s
    .split(/(\-?\d*\.?\d+)/)
    .filter(x => x)
    .map(stringToValue);

const getMinus = v => {
  if (!v) return { minus: false, v };
  const minus = typeof v === 'number' ? v < 0 : v[0] === '-';
  if (!minus) return { minus, value: v };
  return { minus, value: typeof v === 'number' ? -v : v.slice(1) };
};

const sortMultiple = (items1, items2, sortItems) =>
  Array.from({ length: Math.max(items1.length, items2.length) }).reduce(
    (res, _, i) => {
      if (res !== 0) return res;
      if (items1[i] === undefined) return -1;
      if (items2[i] === undefined) return 1;
      return sortItems(items1[i], items2[i]);
    },
    0,
  ) as -1 | 0 | 1;

export const sortStrings = (s1, s2) =>
  sortMultiple(s1.split('|'), s2.split('|'), (v1, v2) =>
    sortMultiple(stringToNatural(v1), stringToNatural(v2), (n1, n2) => {
      if (n1 === n2) return 0;
      const m1 = getMinus(n1);
      const m2 = getMinus(n2);
      if (m1.minus !== m2.minus) return m1.minus ? -1 : 1;
      const dir = m1.minus ? -1 : 1;
      const t1 = typeof m1.value;
      const t2 = typeof m2.value;
      if (t1 === t2) {
        if (t1 === 'string') return dir * m1.value.localeCompare(m2.value);
        return dir * (m1.value < m2.value ? -1 : 1);
      }
      return dir * (t1 === 'number' ? -1 : 1);
    }),
  );

export const toKey = key => {
  if (key.type === 'nil') return '';
  if (key.type === 'string') {
    const value = stringToValue(key.value);
    if (typeof value === 'number' && Math.floor(value) === value) return value;
    return key.value;
  }
  return null;
};

export const list = {
  clearIndices: list => {
    const result = { ...list, values: { ...list.values } };
    result.indices.forEach(i => delete result[i]);
    result.indices = [];
    return result;
  },
  assign: (list, value, key) => {
    if (!key) {
      if (value.type === 'nil') return list;
      const k = (list.indices[list.indices.length - 1] || 0) + 1;
      return {
        ...list,
        values: { ...list.values, [k]: value },
        indices: [...list.indices, k],
      };
    }
    const k = toKey(key);
    if (k === null) return list;
    if (value.type === 'nil' && (!value.set || typeof k === 'number')) {
      const result = { ...list, values: { ...list.values } };
      delete result.values[k];
      if (typeof k === 'number') {
        const i = result.indices.indexOf(k);
        if (i !== -1) {
          result.indices = [
            ...result.indices.slice(0, i),
            ...result.indices.slice(i + 1),
          ];
        }
      }
      return result;
    }
    return {
      ...list,
      values: { ...list.values, [k]: value },
      ...(typeof k === 'number' && list.indices.indexOf(k) === -1
        ? { indices: [...list.indices, k].sort((a, b) => a - b) }
        : {}),
    };
  },
  unpack: (list, value) => {
    if (value.type !== 'list') return list;
    const result = {
      ...list,
      values: { ...list.values },
      indices: [...list.indices],
    };
    const start = list.indices[list.indices.length - 1] || 0;
    const values = { ...value.value.values };
    for (const i of value.value.indices) {
      result.values[start + i] = values[i];
      result.indices.push(start + i);
      delete values[i];
    }
    result.values = { ...result.values, ...values };
    return result;
  },
  other: (list, value, type) => ({
    values: list.values,
    indices: list.indices,
    other: value,
    otherType: type,
  }),
};
