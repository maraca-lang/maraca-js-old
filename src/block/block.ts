import { compare, fromJs, print, toIndex } from '../data';
import { Data, StreamData } from '../typings';

const getIndex = (index, values, get) => {
  let countTrue = 0;
  let countFalse = 0;
  for (let i = 0; i < values.length; i++) {
    const result = get(values[i]);
    if (result.value) countTrue++;
    else countFalse++;
    if (countTrue === index) return result;
    if (countFalse > values.length - i) return null;
  }
};

export const createBlock = () => {
  return { values: {}, indices: [] } as any;
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

export const fromFunc = (func, isMap?) => {
  const result = createBlock();
  result.func = Object.assign(func, { isMap });
  return result;
};

export const fromArray = (items: StreamData[]) => {
  const result = createBlock();
  result.values = {};
  result.indices = items;
  return result;
};

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

export const cloneValues = (block) => {
  const result = createBlock();
  result.values = { ...block.values };
  result.indices = [...block.indices];
  return result;
};

export const blockGet = (block, key, get) => {
  if (key.type === 'block') return block.func || { type: 'value', value: '' };
  const i = toIndex(key.value);
  if (i) {
    return (
      getIndex(i, block.indices, get) ||
      block.func || { type: 'value', value: '' }
    );
  }
  const k = print(key);
  const v = block.values[k] && block.values[k].value;
  return v || block.func || { type: 'value', value: '' };
};

export const blockExtract = (block, keys, get) => {
  const rest = createBlock();
  rest.values = { ...block.values };
  rest.indices = block.indices.map((v) => get(v)).filter((x) => x.value);
  let maxIndex = 0;
  const values = keys.map((key) => {
    const k = print(key);
    const i = toIndex(k);
    if (i) {
      maxIndex = i;
      return rest.indices[i - 1] || { type: 'value', value: '' };
    }
    const v = (rest.values[k] && rest.values[k].value) || {
      type: 'value',
      value: '',
    };
    delete rest.values[k];
    return v;
  });
  rest.indices = rest.indices.slice(maxIndex);
  return { values, rest };
};

export const blockMap = (block, map) => {
  const result = fromPairs(
    Object.keys(block.values).map((k) => ({
      key: block.values[k].key,
      value: map(block.values[k].value, block.values[k].key),
    })),
  );
  result.func = block.func;
  return result;
};

export const clearIndices = (block) => {
  const result = createBlock();
  result.values = block.values;
  result.func = block.func;
  return result;
};

export const blockAppend = (block, value) => {
  const result = createBlock();
  result.values = block.values;
  result.indices = [...block.indices, value];
  result.func = block.func;
  return result;
};

export const blockSet = (block, key, value) => {
  const k = print(key);
  const result = createBlock();
  result.values = { ...block.values, [k]: { key, value } };
  result.indices = block.indices;
  result.func = block.func;
  return result;
};

export const blockUnpack = (block, value) => {
  const result = createBlock();
  result.values = { ...block.values, ...value.values };
  result.indices = [...block.indices, ...value.indices];
  result.func = value.func || block.func;
  return result;
};

export const setFunc = (block, func, isMap?, isPure?) => {
  const result = createBlock();
  result.values = block.values;
  result.indices = block.indices;
  result.func =
    typeof func === 'function' ? Object.assign(func, { isMap, isPure }) : func;
  return result;
};
