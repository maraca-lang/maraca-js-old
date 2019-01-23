import { toData, toTypedValue } from './data';
import fuzzy from './fuzzy';

export const streamMap = map => (create, index, args) =>
  create(index, ({ get, output }) => {
    const run = () => map(...args.map(a => get(a)));
    return { initial: run(), update: () => output(run()) };
  });

const dataMap = map => streamMap((...args) => toData(map(...args)));

const numericMap = map =>
  dataMap((...args) => {
    const values = args.map(a => toTypedValue(a).value);
    if (values.some(v => typeof v !== 'number')) return null;
    return map(...values);
  });

export default {
  constant: (create, index, value) =>
    create(index, ({ output }) => {
      const set = v => output({ ...v, set });
      return { initial: { ...value, set } };
    }),
  clearIndices: streamMap(({ value }) => ({
    type: 'list',
    value: { ...value, indices: [] },
  })),
  '~': streamMap((a, b) => ({ ...b, id: a })),
  '==': dataMap((a, b) => a.type === b.type && a.value === b.value),
  '=': dataMap((a, b) => {
    if (a.type !== 'value' || b.type !== 'value') return null;
    const res = fuzzy(a.value, b.value);
    return res < 0.3 ? null : 2 - res;
  }),
  '!': dataMap((a, b) => {
    if (!b) return a.type === 'nil';
    return a.type !== b.type || a.value !== b.value;
  }),
  '<': numericMap((a, b) => a < b),
  '>': numericMap((a, b) => a > b),
  '<=': numericMap((a, b) => a <= b),
  '>=': numericMap((a, b) => a >= b),
  '+': numericMap((a, b) => a + b),
  '-': dataMap((a, b) => {
    if (!b) return a.type === 'value' ? `-${a.value}` : null;
    const v1 = toTypedValue(a);
    const v2 = toTypedValue(b);
    if (v1.type !== v2.type) return null;
    if (v1.type === 'number') return v1.value - v2.value;
    if (v1.type === 'time') {
      return v1.value.getTime() - v2.value.getTime();
    }
    if (v1.type === 'location') {
      const p = 0.017453292519943295;
      return (
        12742 *
        Math.asin(
          Math.sqrt(
            0.5 -
              Math.cos((v2.value.lat - v1.value.lat) * p) / 2 +
              (Math.cos(v1.value.lat * p) *
                Math.cos(v2.value.lat * p) *
                (1 - Math.cos((v2.value.lng - v1.value.lng) * p))) /
                2,
          ),
        )
      );
    }
    return null;
  }),
  '*': numericMap((a, b) => a * b),
  '/': numericMap((a, b) => a / b),
  '%': numericMap((a, b) => ((a % b) + b) % b),
  '^': numericMap((a, b) => a ** b),
};
