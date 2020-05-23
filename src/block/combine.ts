import { resolve } from '../index';
import { fromPairs } from '../utils';

import blockGet from './get';
import { toPairs } from './set';

const getValueType = (v) => {
  if (v.type === 'value') return 'value';
  if (!v.value.func) return 'block';
  return v.value.func.isMap ? 'map' : 'func';
};
const getType = (s, get) => {
  const v = resolve(s, get, false);
  return { type: getValueType(v), value: v, stream: s };
};
const sortTypes = (s1, s2, get) => {
  const [t1, t2] = [getType(s1, get), getType(s2, get)];
  for (const t of ['map', 'func', 'block']) {
    if (t1.type === t) return [t1, t2];
    if (t2.type === t) return [t2, t1];
  }
  return [t1, t2];
};

export const combineConfig = ([s1, s2]: any[], get) => {
  const [big, small] = sortTypes(s1, s2, get);
  if (big.type === 'value') return ['nil'];
  if (big.type === 'map') {
    if (small.type !== 'block') return ['nil'];
    return ['map', big.value, small.value, {}];
  }
  if (big.type === 'func') {
    if (['func', 'map'].includes(small.type)) return ['nil'];
    const func = big.value.value.func;
    const res = blockGet(big.value.value, small.value, get);
    if (res === func && typeof func !== 'function') return ['value', func];
    if (res === func || !resolve(res, get, false).value) {
      return ['func', func, small.stream];
    }
    return ['value', res];
  }
  if (small.type !== 'value') return ['nil'];
  return ['value', blockGet(big.value.value, small.value, get)];
};

export const combineRun = ([type, ...config]: any[], get, create) => {
  if (type === 'nil') return { type: 'value', value: '' };
  if (type === 'value') return config[0];
  if (type === 'func') {
    const [func, arg] = config;
    return func(create, arg)[0];
  }
  const [big, small] = config;
  const func = big.value.func;
  const pairs = toPairs(small.value, get)
    .map(({ key, value }) => ({ key, value: resolve(value, get, false) }))
    .filter((d) => d.value.value);
  if (func.isPure) {
    return {
      type: 'block',
      value: fromPairs([
        ...toPairs(big.value, get),
        ...func(pairs).filter((d) => d.value.value),
      ]),
    };
  }
  return {
    type: 'block',
    value: fromPairs([
      ...toPairs(big.value, get),
      ...pairs
        .map(({ key, value }) => {
          const [newValue, newKey] = func(key)(create, value);
          return {
            key: resolve(newKey, get, true),
            value: resolve(newValue, get, true),
          };
        })
        .filter((d) => d.value.value),
    ]),
  };

  // const base = cloneBlock(big.value);
  // delete base.func;
  // return pairs.reduce(
  //   (res, { key, value }) => {
  //     const map = func(key);
  //     const [newValue, newKey] = map(create, value);
  //     return create(
  //       streamMap((get) => {
  //         if (!get(newValue).value) return res;
  //         return {
  //           type: 'block',
  //           value: blockSet(get(res).value, newValue, newKey),
  //         };
  //       }),
  //     );
  //   },
  //   { type: 'block', value: base },
  // );
};
