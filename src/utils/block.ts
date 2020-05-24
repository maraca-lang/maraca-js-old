import { print, resolve } from '../index';

import { fromJs, toIndex } from './data';
import { isResolved } from './misc';

export const createBlock = () => {
  return { values: {}, streams: [], indices: [] } as any;
};

export const fromPairs = (pairs: { key; value }[], get) => {
  const result = createBlock();
  const indices = [] as any[];
  pairs.forEach((pair) => {
    const key = resolve(pair.key, get);
    const k = print(key, get);
    const i = toIndex(k);
    if (i) {
      indices.push({ key: i, value: pair.value });
    } else {
      result.values[k] = { key, value: pair.value };
    }
    if (!isResolved(pair.value)) result.unresolved = true;
  });
  result.indices = indices
    .sort((a, b) => a.key - b.key)
    .map((x) => x.value)
    .filter((x) => x.value);
  return result;
};

export const fromObj = (obj) =>
  fromPairs(
    Object.keys(obj).map((k) => ({ key: fromJs(k), value: obj[k] })),
    (x) => x,
  );
