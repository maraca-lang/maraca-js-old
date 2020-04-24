import assign from './assign';
import Block from './block';
import { fromJs } from './data';
import { streamMap } from './util';

const joinValues = (v1, v2, space) => {
  const hasSpace =
    space &&
    v1.value &&
    /\S$/.test(v1.value) &&
    v2.value &&
    /^\S/.test(v2.value);
  return fromJs(`${v1.value || ''}${hasSpace ? ' ' : ''}${v2.value || ''}`);
};

const sortTypes = (v1, v2) => {
  if (v2.type === 'value') return [v1, v2];
  if (v1.type === 'value') return [v2, v1];
  if (v1.value.getFunc()) return [v1, v2];
  if (v2.value.getFunc()) return [v2, v1];
  return [null, null];
};

export const combineConfig = (dot, space) => ([s1, s2]: any[], get) => {
  const [v1, v2] = [get(s1), get(s2)];
  if (v1.type === 'value' && v2.type === 'value') {
    if (dot && (!v1.value || !v2.value)) return ['nil'];
    return ['join', joinValues(v1, v2, space)];
  }
  const [big, small] = sortTypes(v1, v2);
  if (big === null && small === null) return ['nil'];
  const func = big.value.getFunc();
  if (
    (small.type === 'block' && small.value.getFunc()) ||
    (!func && small.type === 'block') ||
    (func && func.isMap && small.type !== 'block')
  ) {
    return ['nil'];
  }
  if (func && func.isMap) return ['map', func, big, small, {}];
  return ['get', func, big.value.get(small), small === v1 ? s1 : s2];
};

const runGet = (get, create, func, v, arg) => {
  if (func && (v === func || !get(v).value)) {
    return typeof func === 'function' ? func(create, arg)[0] : func;
  }
  return v;
};

const wrapStream = (create, x) =>
  x.type === 'stream' ? create(streamMap((get) => get(x))) : x;

export const combineRun = ([type, ...config], get, create) => {
  if (type === 'nil') return { type: 'value', value: '' };
  if (type === 'join') return config[0];
  if (type === 'get') {
    const [func, v, arg] = config;
    return wrapStream(create, runGet(get, create, func, v, arg));
  }
  const [func, big, small] = config;
  if (func.isPure) {
    return {
      type: 'block',
      value: Block.fromPairs([
        ...big.value.toPairs(),
        ...get(func(create, small)[0]).value.toPairs(),
      ]),
    };
  }
  const pairs = small.value
    .toPairs()
    .map(({ key, value }) => ({ key, value: get(value) }))
    .filter((d) => d.value.value);
  return pairs.reduce(
    (res, { key, value }) => {
      const map = func(res, key);
      const [result, current] = map(create, value);
      return assign(false, false, false)([current, result, key], get);
    },
    { type: 'block', value: big.value.cloneValues() },
  );
};
