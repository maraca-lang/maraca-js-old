import { print } from '../index';

import { toIndex } from './data';
import { isResolved } from './misc';

export const createBlock = () => {
  return { values: {}, streams: [], indices: [] } as any;
};

export const cloneBlock = (block) => ({
  values: { ...block.values },
  streams: [...block.streams],
  indices: [...block.indices],
  func: block.func,
  ...(block.unresolved ? { unresolved: true } : {}),
});

export const fromPairs = (pairs: { key; value }[]) => {
  const result = createBlock();
  const indices = [] as any[];
  pairs.forEach((pair) => {
    const k = print(pair.key, (x) => x);
    const i = toIndex(k);
    if (i) {
      indices.push({ key: i, value: pair.value });
    } else {
      result.values[k] = pair;
    }
    if (!isResolved(pair.value)) result.unresolved = true;
  });
  result.indices = indices.sort((a, b) => a.key - b.key).map((x) => x.value);
  return result;
};
