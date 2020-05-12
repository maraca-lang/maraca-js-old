import { print, toIndex } from '../data';

import { cloneBlock, createBlock, toPairs } from './util';

export const isResolved = (data) => {
  if (data.type === 'value') return true;
  if (data.type === 'map' || data.type === 'stream') return false;
  return blockIsResolved(data.value);
};

export const blockIsResolved = (block) =>
  Object.keys(block.values).every(
    (k) => isResolved(block.values[k].key) && isResolved(block.values[k].value),
  ) &&
  block.streams.length === 0 &&
  block.indices.every((x) => x.type !== 'unpack' && isResolved(x));

const blockExtract = (block, keys, get) => {
  const rest = createBlock();
  rest.values = { ...block.values };
  rest.indices = block.indices
    .map((x) => resolve(x, get, false))
    .filter((x) => x.value);
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

const resolveSet = (block, v, k, get) => {
  if (!k) {
    const result = cloneBlock(block);
    const value = resolve(v, get, false);
    if (value.type === 'value') {
      result.values = {
        ...result.values,
        ['']: { key: { type: 'value', value: '' }, value },
      };
    } else {
      result.values = { ...result.values, ...value.value.values };
    }
    return result;
  }
  const key = resolve(k, get, true);
  if (key.type === 'block') {
    const value = resolve(v, get, false);
    if (value.type === 'block') {
      const keyPairs = toPairs(key.value);
      const func = key.value.func;
      const funcDefault = typeof func === 'object' && func;
      const { values, rest } = blockExtract(
        value.value,
        keyPairs.map((d) => d.key),
        get,
      );
      const result = values.reduce(
        (res, v, i) => resolveSet(res, v, keyPairs[i].value, get),
        cloneBlock(block),
      );
      if (funcDefault) {
        result.values = {
          ...result.values,
          [print(funcDefault)]: {
            key: funcDefault,
            value: { type: 'block', value: rest },
          },
        };
      }
      return result;
    }
  }
  const result = cloneBlock(block);
  result.values = { ...block.values, [print(key)]: { key, value: v } };
  return result;
};

const nilValue = { type: 'value', value: '' };
const resolveStreams = (block, get) => {
  let result = createBlock();
  result.values = block.values;
  block.streams.forEach(({ key, value }) => {
    result = resolveSet(result, value, key, get);
  });
  result.indices = block.indices
    .reduce((res, x) => {
      if (x.type !== 'unpack') return [...res, x];
      const value = resolve(x.value, get, false);
      return value.type === 'block' ? [...res, ...value.value.indices] : res;
    }, [])
    .filter((x) => x.value);
  result.func = block.func;
  return result;
};

const resolveSingle = (data, get) => {
  const d = data || nilValue;
  if (d.type === 'map') return resolveSingle(d.map(d.arg, get), get);
  if (d.type === 'stream') return resolveSingle(get(d.value), get);
  if (d.type === 'block') return { ...d, value: resolveStreams(d.value, get) };
  return d;
};

const resolveBlock = (block, get, deep) => {
  let result = createBlock();
  result.values = Object.keys(block.values).reduce(
    (res, k) => ({
      ...res,
      [k]: {
        key: block.values[k].key,
        value: resolve(block.values[k].value, get, deep),
      },
    }),
    {},
  );
  result.indices = block.indices
    .map((x) => resolve(x, get, deep))
    .filter((x) => x.value);
  result.func = block.func;
  return result;
};

const resolve = (d, get, deep) => {
  const v = resolveSingle(d, get);
  if (!deep || isResolved(v)) return v;
  return { ...v, value: resolveBlock(v.value, get, deep) };
};

export default resolve;
