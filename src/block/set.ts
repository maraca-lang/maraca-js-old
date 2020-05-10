import { blockExtract, blockSet, blockUnpack, toPairs } from './block';

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
