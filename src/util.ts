import { blockMap, toPairs } from './block/block';

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

export const streamMap = (map) => (set, get, create) => {
  let result;
  return () => {
    if (result && result.type === 'stream') result.value.cancel();
    result = map(get, create);
    set(result);
  };
};

const hasStream = (data) =>
  toPairs(data.value).some(
    (x) =>
      x.value.type === 'map' ||
      x.value.type === 'stream' ||
      (x.value.type === 'block' && hasStream(x.value)),
  );

const nilValue = { type: 'value', value: '' };
const resolveSingle = (data, get) => {
  const d = data || nilValue;
  if (d.type === 'map') return resolveSingle(d.map(d.arg, get), get);
  if (d.type === 'stream') return resolveSingle(get(d.value), get);
  return d;
};
export const resolve = (d, get, deep) => {
  const v = resolveSingle(d, get);
  if (!deep || v.type === 'value' || !hasStream(v)) return v;
  return { ...v, value: blockMap(v.value, (x) => resolve(x, get, deep)) };
};
