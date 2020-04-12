import Block from './block';
import { fromJs, isEqual, toIndex, toNumber } from './data';
import fuzzy from './fuzzy';

const dataMap = (map) => (args) => fromJs(map(args));

const numericMap = (map) =>
  dataMap((args) => {
    const values = args.map((a) => toNumber(a.value));
    if (values.some((v) => v === null)) return null;
    return map(values);
  });

export default {
  '=': {
    map: dataMap(([a, b]) => isEqual(a, b)),
    deepArgs: [true, true],
  },
  '~': dataMap(([a, b]) => {
    if (a.type === 'block' || b.type === 'block') return null;
    const res = fuzzy(a.value || '', b.value || '');
    return res < 0.3 ? null : 2 - res;
  }),
  '!': dataMap(([a, b]) => {
    if (!b) return !a.value;
    return a.type !== b.type || a.value !== b.value;
  }),
  '<': numericMap(([a, b]) => a < b),
  '>': numericMap(([a, b]) => a > b),
  '<=': numericMap(([a, b]) => a <= b),
  '>=': numericMap(([a, b]) => a >= b),
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
  '#': {
    map: ([a]) => {
      if (a.type === 'block') {
        return fromJs(a.value.toPairs().filter((d) => d.value).length);
      }
      const value = toIndex(a.value);
      if (value) {
        return {
          type: 'block',
          value: Block.fromArray(
            Array.from({ length: value }).map((_, i) => fromJs(i + 1)),
          ),
        };
      }
      return fromJs(null);
    },
    deepArgs: [true],
  },
};
