import {
  sortStrings,
  table,
  tableGet,
  toData,
  toNumber,
  toString,
} from './data';

const typeFunc = (toType, func) => ([a, b]) => {
  const v1 = toType(a);
  const v2 = toType(b);
  if (v1 === null || v2 === null) return { type: 'nil' };
  return toData(func(v1, v2));
};

const tableFunc = func => ([data, ...args]) => {
  if (data.type !== 'nil' && data.type !== 'table') return { type: 'nil' };
  const result = func(data.value || { values: {}, indices: [] }, ...args);
  if (Object.keys(result.values).length === 0 && !result.fill) {
    return { type: 'nil' };
  }
  return { type: 'table', value: result };
};

export default {
  clearIndices: tableFunc(table.clearIndices),
  append: tableFunc(table.append),
  assign: tableFunc(table.assign),
  merge: tableFunc(table.merge),
  fill: tableFunc(table.fill),
  fillGroup: tableFunc(table.fillGroup),
  '~': ([a, b]) => ({ ...b, id: a }),
  '=': ([a, b]) => toData(a.type === b.type && a.value === b.value),
  '!=': ([a, b]) => toData(a.type !== b.type || a.value !== b.value),
  '<': typeFunc(toString, (a, b) => sortStrings(a, b) === 1),
  '>': typeFunc(toString, (a, b) => sortStrings(a, b) === -1),
  '<=': typeFunc(toString, (a, b) => sortStrings(a, b) !== 1),
  '>=': typeFunc(toString, (a, b) => sortStrings(a, b) !== -1),
  '|': typeFunc(toString, (a, b) => a + b),
  '+': typeFunc(toNumber, (a, b) => a + b),
  '-': typeFunc(toNumber, (a, b) => a - b),
  '*': typeFunc(toNumber, (a, b) => a * b),
  '/': typeFunc(toNumber, (a, b) => a / b),
  '%': typeFunc(toNumber, (a, b) => ((a % b) + b) % b),
  '^': typeFunc(toNumber, (a, b) => a ** b),
  '!': ([a]) =>
    a.type === 'nil' ? { type: 'string', value: '1' } : { type: 'nil' },
  '-1': ([a]) => {
    if (a.type === 'table') return tableGet(a.value, '-1');
    const n = toNumber(a);
    if (n !== null) return { type: 'string', value: `${-n}` };
    return { type: 'nil' };
  },
};
