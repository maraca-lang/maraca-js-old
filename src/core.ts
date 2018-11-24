import { compare, listOrNull, toData, toTypedValue } from './data';
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
  clearIndices: streamMap(({ type, value }) =>
    type === 'list' ? listOrNull({ ...value, indices: [] }) : { type: 'nil' },
  ),
  '~': streamMap((a, b) => ({ ...b, id: a })),
  '==': dataMap((a, b) => a.type === b.type && a.value === b.value),
  '=': dataMap((a, b) => {
    if (a.type !== 'value' || b.type !== 'value') return null;
    const res = fuzzy(a.value, b.value);
    return res < 0.3 ? null : 2 - res;
  }),
  '!': dataMap((a, b) => {
    if (!b) return a.type === 'nil' ? 1 : null;
    return a.type !== b.type || a.value !== b.value;
  }),
  '<': dataMap((a, b) => compare(a, b) === -1),
  '>': dataMap((a, b) => compare(a, b) === 1),
  '<=': dataMap((a, b) => compare(a, b) !== 1),
  '>=': dataMap((a, b) => compare(a, b) !== -1),
  '+': numericMap((a, b) => a + b),
  '-': dataMap((a, b) => {
    if (!b) return a.type === 'value' ? `-${a.value}` : null;
    const v1 = toTypedValue(a);
    const v2 = toTypedValue(b);
    if (v1.type !== v2.type) return null;
    if (['integer', 'number'].includes(v1.type)) return v1.value - v2.value;
    if (v1.type === 'time') {
      return (v1.value.getTime() - v2.value.getTime()) / 60000;
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
  '&': (create, index, args) => {
    const revArgs = [...args].reverse();
    return create(index, ({ get, output }) => {
      let prev = [] as any[];
      const run = () => {
        const values = revArgs.map(a => get(a));
        const changed = values.findIndex((v, i) => v !== prev[i]);
        const setters = values.filter(v => v.set);
        prev = values;
        return {
          ...values[changed],
          ...(setters.length === 1 ? { set: setters[0].set } : {}),
        };
      };
      return { initial: run(), update: () => output(run()) };
    });
  },
};
