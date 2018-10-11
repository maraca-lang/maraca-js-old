import {
  sortStrings,
  table,
  toData,
  toDateData,
  toNumber,
  toString,
} from './data';

const streamMap = map => ({ initial, output }) => {
  let values = initial;
  return {
    initial: [map(values)],
    input: updates => {
      updates.forEach(([index, value]) => {
        values[index] = value;
      });
      output(0, map(values));
    },
  };
};

export const unary = {
  '#': ({ output }) => {
    let count = 0;
    return {
      initial: [toData(count)],
      input: () => output(0, toData(++count)),
    };
  },
  '@': ({ initial, output }) => {
    let value = initial[0];
    let prev = toDateData(value);
    const tryOutput = () => {
      const next = toDateData(value);
      if (next.value !== prev.value) output(0, next);
      prev = next;
    };
    const interval = setInterval(tryOutput, 1000);
    return {
      initial: [prev],
      input: updates => {
        if (!updates) {
          clearInterval(interval);
        } else {
          value = updates[0].value;
          tryOutput();
        }
      },
    };
  },
  '!': streamMap(
    ([v]) =>
      v.type === 'nil' ? { type: 'string', value: '1' } : { type: 'nil' },
  ),
  '-': streamMap(([v]) => {
    if (v.type === 'string') {
      return { type: 'string', value: `-${v.value}` };
    }
    return { type: 'nil' };
  }),
};

const typeFunc = (toType, func) => ([a, b]) => {
  const v1 = toType(a);
  const v2 = toType(b);
  if (v1 === null || v2 === null) return { type: 'nil' };
  return toData(func(v1, v2));
};

const tableFunc = func => ([data, ...args]) => {
  if (data.type !== 'nil' && data.type !== 'table') return { type: 'nil' };
  const result = func(data.value || { values: {}, indices: [] }, ...args);
  if (Object.keys(result.values).length === 0 && !result.other) {
    return { type: 'nil' };
  }
  return { type: 'table', value: result };
};

export const binary = {
  clearIndices: tableFunc(table.clearIndices),
  assign: tableFunc(table.assign),
  unpack: tableFunc(table.unpack),
  other: tableFunc(table.other),
  '~': ([a, b]) => ({ ...b, id: a }),
  '=': ([a, b]) => toData(a.type === b.type && a.value === b.value),
  '!=': ([a, b]) => toData(a.type !== b.type || a.value !== b.value),
  '<': typeFunc(toString, (a, b) => sortStrings(a, b) === -1),
  '>': typeFunc(toString, (a, b) => sortStrings(a, b) === 1),
  '<=': typeFunc(toString, (a, b) => sortStrings(a, b) !== 1),
  '>=': typeFunc(toString, (a, b) => sortStrings(a, b) !== -1),
  _: typeFunc(toString, (a, b) => a + b),
  '&': typeFunc(toString, (a, b) => {
    return a + '\uFFFF' + b;
  }),
  '+': typeFunc(toNumber, (a, b) => a + b),
  '-': typeFunc(toNumber, (a, b) => a - b),
  '*': typeFunc(toNumber, (a, b) => a * b),
  '/': typeFunc(toNumber, (a, b) => a / b),
  '%': typeFunc(toNumber, (a, b) => ((a % b) + b) % b),
  '^': typeFunc(toNumber, (a, b) => a ** b),
};
