import * as chrono from 'chrono-node';

export const toData = value => {
  if (!value) return { type: 'nil' };
  if (value === true) return { type: 'string', value: '1' };
  if (typeof value === 'number') return { type: 'string', value: `${value}` };
  if (typeof value === 'string') return { type: 'string', value };
  return { type: 'table', value };
};

export const stringToValue = s =>
  !isNaN(s) && !isNaN(parseFloat(s)) ? parseFloat(s) : s;

export const toNumber = ({ type, value }) => {
  if (type === 'nil') return 0;
  if (type === 'string') {
    const v = stringToValue(value);
    return typeof v === 'number' ? v : null;
  }
  return null;
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
    .split('\uFFFF')
    .map(x => x.match(/\-?([^\.\d]+)|(\.?\d+)|\./g) || [])
    .reduce((res, a) => [...res, ...a], [])
    .map(stringToValue);

export const sortStrings = (s1, s2) => {
  const n1 = stringToNatural(s1);
  const n2 = stringToNatural(s2);
  return Array.from({ length: Math.max(n1.length, n2.length) }).reduce(
    (res, _, i) => {
      if (res !== 0 || n1[i] === n2[i]) return res;
      const m1 = (n1[i] && n1[i][0]) === '-';
      const m2 = (n2[i] && n2[i][0]) === '-';
      const v1 = m1 ? n1[i].slice(1) : n1[i];
      const v2 = m2 ? n2[i].slice(1) : n2[i];
      if (m1 !== m2) return m1 ? -1 : 1;
      const dir = m1 ? -1 : 1;
      const t1 = typeof v1;
      const t2 = typeof v2;
      if (t1 === t2) {
        if (t1 === 'string') return dir * v1.localeCompare(v2);
        return dir * (v1 < v2 ? -1 : 1);
      }
      return dir * (t1 === 'undefined' || t1 === 'number' ? -1 : 1);
    },
    0,
  ) as number;
};

export const toKey = key => {
  if (key.type === 'nil') return '';
  if (key.type === 'string') {
    const value = stringToValue(key.value);
    if (typeof value === 'number' && Math.floor(value) === value) return value;
    return key.value;
  }
  return null;
};

export const table = {
  clearIndices: table => {
    const result = { ...table, values: { ...table.values } };
    result.indices.forEach(i => delete result[i]);
    result.indices = [];
    return result;
  },
  assign: (table, value, key) => {
    if (!key) {
      if (value.type === 'nil') return table;
      const k = (table.indices[table.indices.length - 1] || 0) + 1;
      return {
        ...table,
        values: { ...table.values, [k]: value },
        indices: [...table.indices, k],
      };
    }
    const k = toKey(key);
    if (k === null) return table;
    if (value.type === 'nil' && (!value.set || typeof k === 'number')) {
      const result = { ...table, values: { ...table.values } };
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
      ...table,
      values: { ...table.values, [k]: value },
      ...(typeof k === 'number' && table.indices.indexOf(k) === -1
        ? { indices: [...table.indices, k].sort((a, b) => a - b) }
        : {}),
    };
  },
  unpack: (table, value) => {
    if (value.type !== 'table') return table;
    const result = {
      ...table,
      values: { ...table.values },
      indices: [...table.indices],
    };
    const start = table.indices[table.indices.length - 1] || 0;
    const values = { ...value.value.values };
    for (const i of value.value.indices) {
      result.values[start + i] = values[i];
      result.indices.push(start + i);
      delete values[i];
    }
    result.values = { ...result.values, ...values };
    return result;
  },
  other: (table, value, type) => ({
    values: table.values,
    indices: table.indices,
    other: value,
    otherType: type,
  }),
};
