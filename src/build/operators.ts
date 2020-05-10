import { compare, fromJs, print, toNumber } from '../data';

const dataMap = (map) => (args) => fromJs(map(args));

const numericMap = (map) =>
  dataMap((args) => {
    const values = args.map((a) => toNumber(a.value));
    if (values.some((v) => v === null)) return null;
    return map(values);
  });

export default {
  '=': {
    map: dataMap(([a, b]) => {
      if (a.type !== b.type) return false;
      if (a.type == 'value') return a.value === b.value;
      return print(a) === print(b);
    }),
    deepArgs: [true, true],
  },
  '!': dataMap(([a, b]) => {
    if (!b) return !a.value;
    return a.type !== b.type || a.value !== b.value;
  }),
  '<': {
    map: dataMap(([a, b]) => compare(a, b) === -1),
    deepArgs: [true, true],
  },
  '>': {
    map: dataMap(([a, b]) => compare(a, b) === 1),
    deepArgs: [true, true],
  },
  '<=': {
    map: dataMap(([a, b]) => compare(a, b) !== 1),
    deepArgs: [true, true],
  },
  '>=': {
    map: dataMap(([a, b]) => compare(a, b) !== -1),
    deepArgs: [true, true],
  },
  '+': numericMap(([a, b]) => a + b),
  '-': dataMap(([a, b]) => {
    if (!b) return a.type === 'value' ? `-${a.value}` : null;
    const [x, y] = [toNumber(a.value), toNumber(b.value)];
    return x !== null && y !== null ? x - y : null;
  }),
  '*': numericMap(([a, b]) => a * b),
  '/': numericMap(([a, b]) => a / b),
  '%': numericMap(([a, b]) => ((((a - 1) % b) + b) % b) + 1),
  '^': numericMap(([a, b]) => a ** b),
};
