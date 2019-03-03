import assign from './assign';
import { streamMap } from './core';
import { fromJs } from './data';
import listUtils from './list';

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
  if (typeof value === 'function') return value(create, arg);
  if (value.type !== 'stream' || !func) return [value];
  return [
    create(
      streamMap(([v]) => (v.type === 'nil' ? func(create, arg)[0] : v))([
        value,
      ]),
    ),
  ];
};

const run = (create, { type, reverse, big, small }, [s1, s2], space) => {
  if (type === 'nil') {
    return {
      result: listUtils.fromArray([{ type: 'nil' }]),
      canContinue: info => info.type === 'nil',
    };
  }
  if (type === 'join') {
    return {
      result: listUtils.fromArray([
        create(
          streamMap(([v1, v2]) =>
            fromJs(
              (v1.value || '') +
                (v1.value && v2.value && space ? ' ' : '') +
                (v2.value || ''),
            ),
          )([s1, s2]),
        ),
      ]),
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
    if (result[0].type === 'stream') result[0] = create(copy(result[0]));
    return {
      result: listUtils.fromArray(result),
      canContinue: info =>
        info.type === 'get' &&
        listUtils.get(info.big, info.small) === value &&
        listUtils.getFunc(info.big) === listUtils.getFunc(big),
    };
  }
  const pairs = listUtils.toPairs(small).filter(d => d.value.type !== 'nil');
  return {
    result: listUtils.fromArray([
      pairs.reduce(
        (res, { key, value }) => {
          const map = listUtils.getFunc(big)(...res, key);
          const [result, scope, current] = map(create, value);
          return [scope, create(assign([current, result, key], false, false))];
        },
        [undefined, listUtils.cloneValues(big)],
      )[1],
    ]),
  };
};

const combine = (create, args, dot, space) => {
  const base = create(({ get, output, create }) => {
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
          listUtils.toPairs(result).forEach(s => {
            if (s.value.type === 'stream') s.value.value.stop();
          });
          create();
          ({ result, canContinue } = run(create, info, args, space));
          output(result);
        }
      },
    };
  });
  return [1, 2, 3].map(i =>
    create(
      streamMap(([b]) => listUtils.get(b, fromJs(i)) || { type: 'nil' })([
        base,
      ]),
    ),
  );
};

export default combine;
