import * as chrono from 'chrono-node';

import { compare, list, toData, toTypedValue } from './data';
import fuzzy from './fuzzy';

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

const geocodeCache = {};
const geocodeListeners = {};

const toDateData = ({ type, value }) => {
  if (type !== 'string') return { type: 'nil' };
  const date = chrono.parseDate(value, new Date(), { forwardDate: true });
  return date ? { type: 'string', value: date.toISOString() } : { type: 'nil' };
};

export const unary = {
  '@@': ({ initial, output }) => {
    let unlisten;
    const doLookup = ({ type, value }) => {
      if (unlisten) unlisten();
      if (type === 'string') {
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
    return {
      initial: [doLookup(initial[0])],
      input: updates => {
        if (updates) output(0, doLookup(updates[0][1]));
      },
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
          value = updates[0][1];
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

const dataFunc = func => ([a, b]) => toData(func(a, b));

const numericFunc = func =>
  dataFunc((a, b) => {
    const x = toTypedValue(a);
    const y = toTypedValue(b);
    if (typeof x.value !== 'number' || typeof y.value !== 'number') {
      return null;
    }
    return func(x.value, y.value);
  });

const listFunc = func => ([data, ...args]) => {
  if (data.type !== 'nil' && data.type !== 'list') return data;
  const result = func(data.value || { indices: [], values: {} }, ...args);
  if (
    result.indices.length === 0 &&
    Object.keys(result.values).length === 0 &&
    !result.other
  ) {
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
  '==': ([a, b]) => toData(a.type === b.type && a.value === b.value),
  '=': dataFunc((a, b) => {
    if (a.type !== 'string' || b.type !== 'string') return null;
    const res = fuzzy(a.value, b.value);
    return res < 0.3 ? null : 2 - res;
  }),
  '!': dataFunc((a, b) => a.type !== b.type || a.value !== b.value),
  '<': dataFunc((a, b) => compare(a, b) === -1),
  '>': dataFunc((a, b) => compare(a, b) === 1),
  '<=': dataFunc((a, b) => compare(a, b) !== 1),
  '>=': dataFunc((a, b) => compare(a, b) !== -1),
  '..': dataFunc((a, b) => {
    if (a.type !== 'string' || b.type !== 'string') return null;
    return a.value + b.value;
  }),
  '+': numericFunc((a, b) => a + b),
  '-': dataFunc((a, b) => {
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
  '*': numericFunc((a, b) => a * b),
  '/': numericFunc((a, b) => a / b),
  '%': numericFunc((a, b) => ((a % b) + b) % b),
  '^': numericFunc((a, b) => a ** b),
};
