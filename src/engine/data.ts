import * as chrono from 'chrono-node';

export const toData = value => {
  if (!value) return { type: 'nil' };
  if (value === true) return { type: 'string', value: '1' };
  if (typeof value === 'number') return { type: 'string', value: `${value}` };
  if (typeof value === 'string') return { type: 'string', value };
  return { type: 'table', value };
};

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
  return {
    type: 'string',
    value: chrono
      .parseDate(value, new Date(), { forwardDate: true })
      .toISOString(),
  };
};

export const stringToValue = s => {
  if (s === '-') return -1;
  return !isNaN(s) && !isNaN(parseFloat(s)) ? parseFloat(s) : s;
};

const stringToNatural = s =>
  (s.match(/([^\.\d]+)|(\.?\d+)|\./g) || []).map(stringToValue);

export const sortStrings = (s1, s2) => {
  const n1 = stringToNatural(s1);
  const n2 = stringToNatural(s2);
  return Array.from({ length: Math.max(n1, n2) }).reduce((res, _, i) => {
    if (res !== 0 || n1[i] === n2[i]) return res;
    const t1 = typeof n1[i];
    const t2 = typeof n2[i];
    if (t1 === t2) {
      if (t1 === 'string') return n1[i].localeCompare(n2[i]);
      return n1[i] < n2[i] ? -1 : 1;
    }
    return t1 === 'undefined' || t1 === 'number' ? -1 : 1;
  }, 0);
};

const toKey = (key, { values, indices }) => {
  if (key.type === 'nil') return '';
  if (key.type === 'string') {
    const value =
      key.value === '-' ? (values['-'] ? '-' : -1) : stringToValue(key.value);
    if (typeof value === 'number' && value < 0 && !indices.includes(value)) {
      return indices[indices.length - 1] + value + 1;
    }
    return value;
  }
  return null;
};

export const table = {
  empty: () => ({
    values: {},
    indices: [],
    fill: { type: 'start', value: { type: 'nil' } },
  }),
  fill: (data, value) => ({ ...data, fill: { value } }),
  fillGroup: (data, value) => ({ ...data, fill: { value, group: true } }),
  get: (data, key) => {
    const k = toKey(key, data);
    return k === null ? { type: 'nil' } : data.values[k] || data.fill.value;
  },
  append: (data, value) => {
    if (value.type === 'nil') return data;
    const k = (data.indices[data.indices.length - 1] || 0) + 1;
    return {
      ...data,
      values: { ...data.values, [k]: value },
      indices: [...data.indices, k],
    };
  },
  set: (data, key, value) => {
    const k = toKey(key, data);
    if (k === null) return data;
    if (value.type === 'nil') {
      const result = { ...data, values: { ...data.values } };
      delete result.values[k];
      if (typeof k === 'number') {
        const i = result.indices.indexOf(k);
        if (i !== -1) result.indices = [...result.indices].splice(i, 1);
      }
      return result;
    }
    return {
      ...data,
      values: { ...data.values, [k]: value },
      ...(typeof k === 'number' && data.indices.indexOf(k) === -1
        ? { indices: [...data.indices, k].sort((a, b) => a - b) }
        : {}),
    };
  },
  merge: (data, value) => {
    if (value.type !== 'table') return data;
    const result = {
      ...data,
      values: { ...data.values },
      indices: [...data.indices],
    };
    const start = data.indices[data.indices.length - 1] || 0;
    const values = { ...value.value.values };
    for (const i of value.value.indices) {
      result.values[start + i] = values[i];
      result.indices.push(start + i);
      delete values[i];
    }
    for (const k of Object.keys(values)) {
      result.values[k] = values[k];
    }
    return result;
  },
};
