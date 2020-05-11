import { compare, fromJs, print, toIndex } from '../data';
import { Data, StreamData } from '../typings';

export const createBlock = () => {
  return { values: {}, streams: [], indices: [] } as any;
};

export const cloneBlock = (block) => ({
  values: { ...block.values },
  streams: [...block.streams],
  indices: [...block.indices],
  func: block.func,
});

export const toPairs = (block) => {
  const values = Object.keys(block.values)
    .map((k) => block.values[k])
    .sort((a, b) => compare(a.key, b.key));
  const indices = block.indices.map((value, i) => ({
    key: fromJs(i + 1),
    value: value.value,
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
  result.indices = indices
    .sort((a, b) => a.key - b.key)
    .map((x) => ({ type: 'single', value: x.value }));
  return result;
};

export const toBoth = (block) => {
  return {
    indices: block.indices.map((x) => x.value),
    values: Object.keys(block.values).reduce((res, k) => {
      const key = k.startsWith("'")
        ? k.slice(1, -1).replace(/\\([\s\S])/g, (_, m) => m)
        : k;
      return { ...res, [key]: block.values[k].value };
    }, {}),
  };
};

export const blockSet = (block, value, key) => {
  const result = cloneBlock(block);
  if (!key) {
    result.streams = [...block.streams, { value }];
    result.indices = [...block.indices, { type: 'unpack', value }];
    return result;
  }
  if (key.type === 'value') {
    result.values = { ...block.values, [print(key)]: { key, value } };
    return result;
  }
  result.streams = [...block.streams, { key, value }];
  return result;
};
