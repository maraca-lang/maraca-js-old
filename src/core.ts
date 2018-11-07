import * as chrono from 'chrono-node';

import {
  compare,
  listGet,
  listOrNull,
  resolve,
  toData,
  toKey,
  toTypedValue,
  resolveDeep,
} from './data';
import fuzzy from './fuzzy';

export const streamMap = (map, deep = false) => (queue, args) =>
  queue(1, ({ get, output }) => {
    const resolveArg = a => (deep ? resolveDeep(get(a), get) : resolve(a, get));
    return {
      initial: [map(...args.map(resolveArg))],
      input: () => output(0, map(...args.map(resolveArg))),
    };
  })[0];

const toDateData = ({ type, value }) => {
  if (type !== 'value') return { type: 'nil' };
  const date = chrono.parseDate(value, new Date(), { forwardDate: true });
  return date ? { type: 'value', value: date.toISOString() } : { type: 'nil' };
};

const geocodeCache = {};
const geocodeListeners = {};

const dataMap = map => streamMap((...args) => toData(map(...args)));

const numericMap = map =>
  dataMap((...args) => {
    const values = args.map(a => toTypedValue(a).value);
    if (values.some(v => typeof v !== 'number')) return null;
    return map(...values);
  });

const set = (unpack, get, list, v, k) => {
  if (!k) {
    const value = v.type === 'stream' ? resolve(v.value, get) : v;
    if (value.type === 'nil') return list;
    if (!unpack || value.type === 'value') {
      return { ...list, indices: [...list.indices, value] };
    }
    return {
      ...list,
      indices: [...list.indices, ...value.value.indices],
      values: { ...list.values, ...value.value.values },
    };
  }
  const key = k.type === 'stream' ? resolve(k.value, get) : k;
  if (unpack && key.type === 'list') {
    const value = v.type === 'stream' ? resolve(v.value, get) : v;
    return [
      ...key.value.indices.map((v, i) => ({ key: toData(i + 1), value: v })),
      ...Object.keys(key.value.values).map(k => key.value.values[k]),
    ].reduce(
      (res, p) => set(unpack, get, res, listGet(value, p.key), p.value),
      list,
    );
  }
  const objKey = toKey(key);
  if (typeof objKey === 'number') {
    const value = v.type === 'stream' ? resolve(v.value, get) : v;
    const indices = [...list.indices];
    if (value.type === 'nil') delete indices[objKey];
    else indices[objKey] = value;
    return { ...list, indices };
  }
  return {
    ...list,
    values: {
      ...list.values,
      [objKey]: { key, value: v },
    },
  };
};

export default {
  constant: (queue, value) => queue(1, () => ({ initial: [value] }))[0],
  clearIndices: streamMap(
    ({ type, value }) =>
      type === 'list' ? listOrNull({ ...value, indices: [] }) : { type: 'nil' },
  ),
  set: unpack => (queue, [l, v, k]: any) =>
    queue(1, ({ get, output }) => {
      const run = () => {
        const list = resolve(l, get);
        if (list.type === 'value') return list;
        const result = set(
          unpack,
          get,
          list.value || { indices: [], values: {} },
          { type: 'stream', value: v },
          k && { type: 'stream', value: k },
        );
        if (
          result.indices.length + Object.keys(result.values).length === 0 &&
          !result.other
        ) {
          return { type: 'nil' };
        }
        return { type: 'list', value: result };
      };
      return { initial: [run()], input: () => output(0, run()) };
    }),
  '@@': (queue, [arg]) =>
    queue(1, ({ get, output }) => {
      let unlisten;
      const doLookup = () => {
        const { type, value } = resolve(arg, get);
        if (unlisten) unlisten();
        if (type === 'value') {
          if (!geocodeCache[value]) {
            if (!geocodeListeners[value]) {
              geocodeListeners[value] = [];
              (async () => {
                const result = await (await fetch(
                  `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
                    value,
                  )}&key=AIzaSyCQ8P7-0kTGz2_tkcHjOo0IUiMB_z9Bbp4`,
                )).json();
                geocodeCache[value] = toData(
                  JSON.stringify(result.results[0].geometry.location),
                );
                geocodeListeners[value].forEach(l => l());
                geocodeListeners[value] = null;
              })();
            }
            const listener = () => output(0, geocodeCache[value]);
            geocodeListeners[value].push(listener);
            unlisten = () =>
              geocodeListeners[value].splice(
                geocodeListeners[value].indexOf(listener),
                1,
              );
            return { type: 'nil' };
          }
          return geocodeCache[value];
        }
      };
      return { initial: [doLookup()], input: output(0, doLookup()) };
    }),
  '@': (queue, [arg]) =>
    queue(1, ({ get, output }) => {
      let prev = toDateData(resolve(arg, get));
      const tryOutput = () => {
        const next = toDateData(resolve(arg, get));
        if (next.value !== prev.value) output(0, next);
        prev = next;
      };
      let interval = setInterval(tryOutput, 1000);
      return {
        initial: [prev],
        input: () => {
          clearInterval(interval);
          tryOutput();
          interval = setInterval(tryOutput, 1000);
        },
        stop: () => clearInterval(interval),
      };
    })[0],
  '~': streamMap((a, b) => ({ ...b, id: a })),
  '==': dataMap((a, b) => a.type === b.type && a.value === b.value),
  '=': dataMap((a, b) => {
    if (a.type !== 'value' || b.type !== 'value') return null;
    const res = fuzzy(a.value, b.value);
    return res < 0.3 ? null : 2 - res;
  }),
  '!': dataMap((a, b) => {
    if (!b) a.type === 'nil' ? 1 : null;
    return a.type !== b.type || a.value !== b.value;
  }),
  '<': dataMap((a, b) => compare(a, b) === -1),
  '>': dataMap((a, b) => compare(a, b) === 1),
  '<=': dataMap((a, b) => compare(a, b) !== 1),
  '>=': dataMap((a, b) => compare(a, b) !== -1),
  '..': dataMap((a, b) => {
    if (a.type !== 'value' || b.type !== 'value') return null;
    return a.value + b.value;
  }),
  '+': numericMap((a, b) => a + b),
  '-': dataMap((a, b) => {
    if (!b) return a.type === 'value' ? `-${a.value}` : null;
    const v1 = toTypedValue(a);
    const v2 = toTypedValue(b);
    if (v1.type !== v2.type) return null;
    if (v1.type === 'number') return v1.value - v2.value;
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
  '&': (queue, args) => {
    const revArgs = [...args].reverse();
    return queue(1, ({ get, output }) => {
      let prev = [] as any[];
      const run = () => {
        const values = revArgs.map(a => resolve(a, get));
        const changed = values.findIndex((v, i) => v !== prev[i]);
        const setters = values.filter(v => v.set);
        prev = values;
        return {
          ...values[changed],
          ...(setters.length === 1 ? { set: setters[0].set } : {}),
        };
      };
      return { initial: [run()], input: () => output(0, run()) };
    });
  },
};
