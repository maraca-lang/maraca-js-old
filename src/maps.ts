import Block from './block';
import { fromJs, isEqual, toJs } from './data';
import fuzzy from './fuzzy';

const dataMap = (map) => (args) => fromJs(map(args));

const numericMap = (map) =>
  dataMap((args) => {
    const values = args.map((a) => toJs(a));
    if (values.some((v) => typeof v !== 'number')) return null;
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
    const v1 = toJs(a);
    const v2 = toJs(b);
    const t1 = Object.prototype.toString.call(v1);
    const t2 = Object.prototype.toString.call(v2);
    if (t1 != t2) return null;
    if (t1 === '[object Number]') return v1 - v2;
    if (t1 === '[object Date]') return v1.getTime() - v2.getTime();
    if (t1 === '[object Object]') {
      const p = 0.017453292519943295;
      return (
        12742 *
        Math.asin(
          Math.sqrt(
            0.5 -
              Math.cos((v2.lat - v1.lat) * p) / 2 +
              (Math.cos(v1.lat * p) *
                Math.cos(v2.lat * p) *
                (1 - Math.cos((v2.lng - v1.lng) * p))) /
                2,
          ),
        )
      );
    }
    return null;
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
      const value = toJs(a);
      if (typeof value === 'number' && Math.floor(value) === value) {
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
