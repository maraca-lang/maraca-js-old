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
  return {
    type: 'string',
    value: chrono
      .parseDate(value, new Date(), { forwardDate: true })
      .toISOString(),
  };
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

export const toKey = (key, indices) => {
  if (key.type === 'nil') return '';
  if (key.type === 'string') {
    const value = stringToValue(key.value);
    if (typeof value === 'number' && Math.floor(value) === value) {
      if (value < 0) {
        return Math.max(0, indices[indices.length - 1] + value + 1) || null;
      }
      return value;
    }
    return key.value;
  }
  return null;
};
