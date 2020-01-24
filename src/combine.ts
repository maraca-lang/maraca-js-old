import assign from './assign';
import { streamMap } from './build';
import { fromJs } from './data';
import listUtils from './list';

const joinValues = (v1, v2, space) =>
  fromJs(
    (v1.value || '') +
      (v1.value &&
      /\S$/.test(v1.value) &&
      v2.value &&
      /^\S/.test(v2.value) &&
      space
        ? ' '
        : '') +
      (v2.value || ''),
  );

export const combineValues = (v1, v2, dot, space) => {
  if ([v1, v2].every(v => v.type !== 'list')) {
    if (dot && [v1, v2].some(v => v.type === 'nil')) return { type: 'nil' };
    return joinValues(v1, v2, space);
  }
  if ([v1, v2].every(v => v.type === 'list')) return { type: 'nil' };
  const [l, v] = v1.type === 'list' ? [v1, v2] : [v2, v1];
  return listUtils.get(l, v);
};

const sortTypes = (v1, v2) => {
  if (v2.type === 'nil') return [v1, v2];
  if (v1.type === 'nil') return [v2, v1];
  if (v2.type === 'value') return [v1, v2];
  if (v1.type === 'value') return [v2, v1];
  if (!listUtils.getFunc(v2)) return [v1, v2];
  if (!listUtils.getFunc(v1)) return [v2, v1];
  return [null, null];
};

const getType = (big, small) => {
  if (big.type === 'nil' || (big === null && small === null)) return 'nil';
  if (big.type === 'value') return 'join';
  const func = listUtils.getFunc(big);
  if (func && func.isMap && small.type !== 'list') return 'nil';
  return func && func.isMap ? 'map' : 'get';
};

const getInfo = ([s1, s2], get, dot) => {
  const v1 = get(s1);
  const v2 = get(s2);
  const [b, s] = sortTypes(v1, v2);
  const [big, small] =
    dot && b.type === 'value' && s.type === 'nil'
      ? [listUtils.empty(), b]
      : [b, s];
  return { type: getType(big, small), reverse: small === v1, big, small };
};

const copy = stream => ({ get, output }) => ({
  initial: get(stream),
  update: () => output(get(stream)),
});

const runGet = (create, value, func, arg) => {
  if (typeof value === 'function') return value(create, arg)[0];
  if (value.type !== 'stream' || !func) return value;
  return create(
    streamMap(([v]) => (v.type === 'nil' ? func(create, arg)[0] : v))([value]),
  );
};

const run = (create, { type, reverse, big, small }, [s1, s2], space) => {
  if (type === 'nil') {
    return {
      result: { type: 'nil' },
      canContinue: info => info.type === 'nil',
    };
  }
  if (type === 'join') {
    return {
      result: create(
        streamMap(([v1, v2]) => joinValues(v1, v2, space))([s1, s2]),
      ),
      canContinue: info => info.type === 'join',
    };
  }
  if (type === 'get') {
    const value = listUtils.get(big, small);
    const result = runGet(
      create,
      value,
      listUtils.getFunc(big),
      reverse ? s1 : s2,
    );
    return {
      result: result.type === 'stream' ? create(copy(result)) : result,
      canContinue: info =>
        info.type === 'get' &&
        listUtils.get(info.big, info.small) === value &&
        listUtils.getFunc(info.big) === listUtils.getFunc(big),
    };
  }
  const func = listUtils.getFunc(big);
  if (func.isPure) {
    return {
      result: create(
        streamMap(([b, s]) => {
          return listUtils.fromPairs([
            ...listUtils.toPairs(b),
            ...listUtils.toPairs(s),
          ]);
        })([big, func(create, small)[0]]),
      ),
    };
  }
  const pairs = listUtils.toPairs(small).filter(d => d.value.type !== 'nil');
  return {
    result: pairs.reduce(
      (res, { key, value }) => {
        const map = func(...res, key);
        const [result, scope, current] = map(create, value);
        return [
          scope,
          create(assign([current, result, key], false, false, false)),
        ];
      },
      [undefined, listUtils.cloneValues(big)],
    )[1],
  };
};

export default (create, args, dot, space) =>
  create(({ get, output, create }) => {
    let { result, canContinue } = run(
      create,
      getInfo(args, get, dot),
      args,
      space,
    );
    return {
      initial: result,
      update: () => {
        const info = getInfo(args, get, dot);
        if (!canContinue || !canContinue(info)) {
          if (result.type === 'stream') result.value.cancel();
          ({ result, canContinue } = run(create, info, args, space));
          output(result);
        }
      },
    };
  });
