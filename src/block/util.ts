import { compare, fromJs, print, toIndex } from '../data';
import { Data, StreamData } from '../typings';

export const createBlock = () => {
  return { values: {}, indices: [] } as any;
};

export const cloneBlock = (block) => ({
  values: { ...block.values },
  indices: [...block.indices],
  func: block.func,
});

export const blockIsResolved = (_) => false;

export const toPairs = (block) => {
  const values = Object.keys(block.values)
    .map((k) => block.values[k])
    .sort((a, b) => compare(a.key, b.key));
  const indices = block.indices.map((value, i) => ({
    key: fromJs(i + 1),
    value,
  }));
  if (values[0] && !values[0].key.value) {
    return [values[0], ...indices, ...values.slice(1)];
  }
  return [...indices, ...values];
};
export const fromPairs = (pairs: { key: Data; value: StreamData }[]) => {
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
  });
  result.indices = indices.sort((a, b) => a.key - b.key).map((x) => x.value);
  return result;
};

export const toBoth = (block) => {
  return {
    indices: block.indices,
    values: Object.keys(block.values).reduce((res, k) => {
      const key = k.startsWith("'")
        ? k.slice(1, -1).replace(/\\([\s\S])/g, (_, m) => m)
        : k;
      return { ...res, [key]: block.values[k].value };
    }, {}),
  };
};
