import { print, toIndex } from '../data';

import { cloneBlock, createBlock, toPairs } from './util';

const blockSet = (block, key, value) => {
  const result = cloneBlock(block);
  result.values = { ...block.values, [print(key)]: { key, value } };
  return result;
};

const blockUnpack = (block, value) => {
  const result = createBlock();
  result.values = { ...block.values, ...value.values };
  result.indices = [...block.indices, ...value.indices];
  result.func = value.func || block.func;
  return result;
};

const blockExtract = (block, keys, get) => {
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

const set = (noDestructure) => ([l, v, k]: any[], get) => {
  const key = k && get(k, true);
  if (!noDestructure && (!key || key.type === 'block')) {
    const value = get(v);
    if (value.type === 'block') {
      if (!key) {
        return { type: 'block', value: blockUnpack(get(l).value, value.value) };
      }
      const keyPairs = toPairs(key.value);
      const func = key.value.func;
      const funcDefault = typeof func === 'object' && func;
      const { values, rest } = blockExtract(
        value.value,
        keyPairs.map((d) => d.key),
        get,
      );
      const result = values.reduce(
        (res, v, i) => set(false)([res, v, keyPairs[i].value], get),
        l,
      );
      if (!funcDefault) return result;
      return set(true)(
        [result, { type: 'block', value: rest }, funcDefault],
        get,
      );
    }
  }
  return {
    type: 'block',
    value: blockSet(get(l).value, key || { type: 'value', value: '' }, v),
  };
};

export default set;
