import { compare, fromJs, print, toIndex } from './data';
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

export const toPairs = (block) => {
  const values = Object.keys(block.values)
    .map((k) => block.values[k])
    .sort((a, b) => compare(a.key, b.key));
  const indices = block.indices.map((value, i) => ({
    key: fromJs(i + 1),
    value: value,
  }));
  if (values[0] && !values[0].key.value) {
    return [values[0], ...indices, ...values.slice(1)];
  }
  return [...indices, ...values];
};

export const fromPairs = (pairs: { key; value }[]) => {
  const result = createBlock();
  const indices = [] as any[];
  pairs.forEach((pair) => {
    const k = print(pair.key);
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
