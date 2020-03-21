import assign from './assign';
import { streamMap } from './build';
import { fromJs } from './data';
import Box from './box';

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
  if ([v1, v2].every((v) => v.type !== 'box')) {
    if (dot && [v1, v2].some((v) => !v.value)) {
      return { type: 'value', value: '' };
    }
    return joinValues(v1, v2, space);
  }
  if ([v1, v2].every((v) => v.type === 'box')) {
    return { type: 'value', value: '' };
  }
  const [l, v] = v1.type === 'box' ? [v1, v2] : [v2, v1];
  return l.value.get(v);
};

const sortTypes = (v1, v2) => {
  if (!v2.value) return [v1, v2];
  if (!v1.value) return [v2, v1];
  if (v2.type === 'value') return [v1, v2];
  if (v1.type === 'value') return [v2, v1];
  if (!v2.value.getFunc()) return [v1, v2];
  if (!v1.value.getFunc()) return [v2, v1];
  return [null, null];
};

const getType = (big, small) => {
  if (!big.value || (big === null && small === null)) return 'nil';
  if (big.type === 'value') return 'join';
  const func = big.value.getFunc();
  if (func && func.isMap && small.type !== 'box') return 'nil';
  return func && func.isMap ? 'map' : 'get';
};

const getInfo = ([s1, s2], get, dot) => {
  const v1 = get(s1);
  const v2 = get(s2);
  const [b, s] = sortTypes(v1, v2);
  const [big, small] =
    dot && b.type === 'value' && !s.value
      ? [{ type: 'box', value: new Box() }, b]
      : [b, s];
  return { type: getType(big, small), reverse: small === v1, big, small };
};

const copy = (stream) => (set, get) => () => set(get(stream));

const runGet = (create, value, func, arg) => {
  if (typeof value === 'function') return value(create, arg)[0];
  if (value.type !== 'stream' || !func) return value;
  return create(
    streamMap(([v]) => (!v.value ? func(create, arg)[0] : v))([value]),
  );
};

const run = (create, { type, reverse, big, small }, [s1, s2], space) => {
  if (type === 'nil') {
    return {
      result: { type: 'value', value: '' },
      canContinue: (info) => info.type === 'nil',
    };
  }
  if (type === 'join') {
    return {
      result: create(
        streamMap(([v1, v2]) => joinValues(v1, v2, space))([s1, s2]),
      ),
      canContinue: (info) => info.type === 'join',
    };
  }
  if (type === 'get') {
    const value = big.value.get(small);
    const result = runGet(
      create,
      value,
      big.value.getFunc(),
      reverse ? s1 : s2,
    );
    return {
      result: result.type === 'stream' ? create(copy(result)) : result,
      canContinue: (info) =>
        info.type === 'get' &&
        info.big.value.get(info.small) === value &&
        info.big.value.getFunc() === big.value.getFunc(),
    };
  }
  const func = big.value.getFunc();
  if (func.isPure) {
    return {
      result: create(
        streamMap(([b, s]) => ({
          type: 'box',
          value: Box.fromPairs([...b.value.toPairs(), ...s.value.toPairs()]),
        }))([big, func(create, small)[0]]),
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
          create(assign([current, result, key], false, false, false)),
        ];
      },
      [undefined, { type: 'box', value: big.value.cloneValues() }],
    )[1],
  };
};

export default (create, args, dot, space) =>
  create((set, get, create) => {
    let result;
    let canContinue;
    return () => {
      const info = getInfo(args, get, dot);
      if (!canContinue || !canContinue(info)) {
        if (result && result.type === 'stream') result.value.cancel();
        ({ result, canContinue } = run(create, info, args, space));
        set(result);
      }
    };
  });
