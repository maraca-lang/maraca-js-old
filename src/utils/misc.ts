import { fromPairs, toPairs } from './block';

export const isResolved = (data) => {
  if (data.type === 'map' || data.type === 'stream') return false;
  if (data.type === 'value') return true;
  return !data.value.unresolved;
};

const nilValue = { type: 'value', value: '' };
export const resolveType = (data, get) => {
  const d = data || nilValue;
  if (d.type === 'map') return resolveType(d.map(d.arg, get), get);
  if (d.type === 'stream') return resolveType(get(d.value), get);
  return d;
};

export const sortMultiple = <T = any>(
  items1: T[],
  items2: T[],
  sortItems: (a: T, b: T) => number,
  reverseUndef = false,
) =>
  Array.from({ length: Math.max(items1.length, items2.length) }).reduce(
    (res, _, i) => {
      if (res !== 0) return res;
      if (items1[i] === undefined) return reverseUndef ? 1 : -1;
      if (items2[i] === undefined) return reverseUndef ? -1 : 1;
      return sortItems(items1[i], items2[i]);
    },
    0,
  ) as -1 | 0 | 1;

export const wrapStream = (create, x) =>
  x.type === 'stream' ? { type: 'stream', value: create((set) => set(x)) } : x;

export const streamMap = (map) => (set, get, create) => {
  let result;
  return () => {
    if (result && result.type === 'stream') result.value.cancel();
    result = wrapStream(create, map(get, create));
    set(result);
  };
};

export const pushable = (arg) => (set, get) => {
  const push = (v) => set({ ...v, push });
  return () => set({ push, ...resolveType(arg, get) });
};

export const snapshot = (create, { push, ...value }) => {
  const result =
    value.type !== 'block'
      ? value
      : {
          type: 'block',
          value: fromPairs(
            toPairs(value.value).map(({ key, value }) => ({
              key,
              value: snapshot(create, value),
            })),
          ),
        };
  if (!push) return result;
  return { type: 'stream', value: create(pushable(result), true) };
};
