import {
  sortStrings,
  list,
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

const listFunc = func => ([data, ...args]) => {
  if (data.type !== 'nil' && data.type !== 'list') return data;
  const result = func(data.value || { values: {}, indices: [] }, ...args);
  if (Object.keys(result.values).length === 0 && !result.other) {
    return { type: 'nil' };
  }
  return { type: 'list', value: result };
};

export const binary = {
  clearIndices: listFunc(list.clearIndices),
  assign: listFunc(list.assign),
  unpack: listFunc(list.unpack),
  other: listFunc(list.other),
  '~': ([a, b]) => ({ ...b, id: a }),
  '=': ([a, b]) => toData(a.type === b.type && a.value === b.value),
  '!': ([a, b]) => toData(a.type !== b.type || a.value !== b.value),
  '<': typeFunc(toString, (a, b) => sortStrings(a, b) === -1),
  '>': typeFunc(toString, (a, b) => sortStrings(a, b) === 1),
  '<=': typeFunc(toString, (a, b) => sortStrings(a, b) !== 1),
  '>=': typeFunc(toString, (a, b) => sortStrings(a, b) !== -1),
  '|': typeFunc(toString, (a, b) => a + '|' + b),
  '..': typeFunc(toString, (a, b) => a + b),
  '+': typeFunc(toNumber, (a, b) => a + b),
  '-': typeFunc(toNumber, (a, b) => a - b),
  '*': typeFunc(toNumber, (a, b) => a * b),
  '/': typeFunc(toNumber, (a, b) => a / b),
  '%': typeFunc(toNumber, (a, b) => ((a % b) + b) % b),
  '^': typeFunc(toNumber, (a, b) => a ** b),
};
