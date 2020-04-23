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

export const combineConfig = ([s1, s2]: any[], get, dot): any => {
  const [v1, v2] = [get(s1), get(s2)];
  if (v1.type === 'value' && v2.type === 'value') {
    if (dot && (!v1.value || !v2.value)) return { type: 'nil' };
    return { type: 'join', values: [v1, v2] };
  }
  const [big, small] = sortTypes(v1, v2);
  if (big === null && small === null) return { type: 'nil' };
  const func = big.value.getFunc();
  if (
    (small.type === 'block' && small.value.getFunc()) ||
    (!func && small.type === 'block') ||
    (func && func.isMap && small.type !== 'block')
  ) {
    return { type: 'nil' };
  }
  return {
    type: func && func.isMap ? 'map' : 'get',
    values: [big, small],
    arg: small === v1 ? s1 : s2,
  };
};

const runGet = (get, create, func, v, arg) => {
  if (func && (v === func || !get(v).value)) {
    return typeof func === 'function' ? func(create, arg)[0] : func;
  }
  return v;
};

export const combineRun = (get, create, { type, values, arg }, space) => {
  if (type === 'nil') {
    return { result: { type: 'value', value: '' } };
  }
  if (type === 'join') {
    return { result: joinValues(values[0], values[1], space) };
  }
  const [big, small] = values;
  const func = big.value.getFunc();
  if (type === 'get') {
    const v = big.value.get(small);
    const result = runGet(get, create, func, v, arg);
    return {
      result:
        result.type === 'stream'
          ? create(streamMap((get) => get(result)))
          : result,
      canContinue: (info) =>
        info.type === 'get' &&
        info.values[0].value.get(info.values[1]) === v &&
        info.values[0].value.getFunc() === func,
    };
  }
  if (func.isPure) {
    return {
      result: create(
        streamMap((get, create) => ({
          type: 'block',
          value: Block.fromPairs([
            ...get(big).value.toPairs(),
            ...get(func(create, small)[0]).value.toPairs(),
          ]),
        })),
      ),
    };
  }
  const pairs = small.value.toPairs().filter((d) => d.value.value);
  return {
    result: pairs.reduce(
      (res, { key, value }) => {
        const map = func(...res, key);
        const [result, scope, current] = map(create, value);
        return [
          scope,
          create((set, get) => () =>
            set(assign(false, false, false)([current, result, key], get)),
          ),
        ];
      },
      [undefined, { type: 'block', value: big.value.cloneValues() }],
    )[1],
  };
};
