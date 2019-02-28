import { fromJs, toJs } from './data';
import fuzzy from './fuzzy';

export const streamMap = map => args => ({ get, output, create }) => {
  const run = () => {
    create();
    return map(args.map(a => get(a)), create);
  };
  return { initial: run(), update: () => output(run()) };
};

const dataMap = map => streamMap(args => fromJs(map(args)));

const numericMap = map =>
  dataMap(args => {
    const values = args.map(a => toJs(a));
    if (values.some(v => typeof v !== 'number')) return null;
    return map(values);
  });

export default {
  constant: value => ({ output }) => {
    const set = v => output({ ...v, set });
    return { initial: { ...value, set } };
  },
  clearIndices: streamMap(([{ value }]) => ({
    type: 'list',
    value: { ...value, indices: [] },
  })),
  '~': streamMap(([a, b]) => ({ ...b, id: a })),
  '==': dataMap(([a, b]) => a.type === b.type && a.value === b.value),
  '=': dataMap(([a, b]) => {
    if (a.type !== 'value' || b.type !== 'value') return null;
    const res = fuzzy(a.value, b.value);
    return res < 0.3 ? null : 2 - res;
  }),
  '!': dataMap(([a, b]) => {
    if (!b) return a.type === 'nil';
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
  '%': numericMap(([a, b]) => ((a % b) + b) % b),
  '^': numericMap(([a, b]) => a ** b),
  '&': args => ({ get, output }) => {
    let values = args.map(get);
    return {
      initial: values[1],
      update: () => {
        const newValues = args.map(get);
        if (values[0] !== newValues[0]) output({ ...newValues[1] });
        values = newValues;
      },
    };
  },
};
