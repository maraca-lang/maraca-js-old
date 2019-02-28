import assign from './assign';
import { streamMap } from './core';
import { compare, fromJs, toKey } from './data';

const sortTypes = (v1, v2) => {
  if (v2.type === 'nil') return [v1, v2];
  if (v1.type === 'nil') return [v2, v1];
  if (v2.type === 'value') return [v1, v2];
  if (v1.type === 'value') return [v2, v1];
  if (!v2.value.other) return [v1, v2];
  if (!v1.value.other) return [v2, v1];
  return [null, null];
};

const getType = (big, small) => {
  if (big === 'nil' || (big === null && small === null)) return 'nil';
  if (big.value.otherMap) return 'map';
  if (big.type === 'list') return 'get';
  return 'join';
};

const getInfo = ([s1, s2], get, dot) => {
  const v1 = get(s1);
  const v2 = get(s2);
  const [b, s] = sortTypes(v1, v2);
  const [big, small] =
    dot && b.type === 'value' && s.type === 'nil'
      ? [{ type: 'list', value: { indices: [], values: {} } }, b]
      : [b, s];
  return { type: getType(big, small), reverse: small === v1, big, small };
};

const toList = indices => ({
  type: 'list',
  value: { indices, values: {} },
});

const copy = stream => ({ get, output }) => ({
  initial: get(stream),
  update: () => output(get(stream)),
});

const listGet = ({ type, value }, key, withMap = false) => {
  if (type !== 'list') return { type: 'nil' };
  const k = toKey(key);
  const v =
    typeof k === 'number'
      ? value.indices[k]
      : value.values[k] && value.values[k].value;
  return v || ((withMap || !value.otherMap) && value.other) || { type: 'nil' };
};

const runGet = (create, value, other, arg) => {
  if (typeof value === 'function') return value(create, arg);
  if (value.type !== 'stream' || !other) return [value];
  return [
    create(
      streamMap(([v]) => (v.type === 'nil' ? other(create, arg)[0] : v))([
        value,
      ]),
    ),
  ];
};

const run = (create, { type, reverse, big, small }, [s1, s2], space) => {
  if (type === 'nil') {
    return {
      result: toList([{ type: 'nil' }]),
      canContinue: info => info.type === 'nil',
    };
  }
  if (type === 'join') {
    return {
      result: toList([
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
    const value = listGet(big, small);
    const result = runGet(create, value, big.value.other, reverse ? s1 : s2);
    if (result[0].type === 'stream') result[0] = create(copy(result[0]));
    return {
      result: toList(result),
      canContinue: info =>
        info.type === 'get' &&
        listGet(info.big, info.small) === value &&
        info.big.other === big.other,
    };
  }
  const pairs = [
    ...small.value.indices.map((v, i) => ({ key: fromJs(i + 1), value: v })),
    ...Object.keys(small.value.values)
      .filter(k => small.value.values[k].value.type !== 'nil')
      .map(k => small.value.values[k]),
  ].sort((a, b) => compare(a.key, b.key));
  return {
    result: toList([
      pairs.reduce(
        (res, { key, value }) => {
          const map = big.value.other(...res, key);
          const [result, scope, current] = map(create, value);
          return [scope, create(assign([current, result, key], false, false))];
        },
        [
          undefined,
          {
            type: 'list',
            value: { indices: big.value.indices, values: big.value.values },
          },
        ],
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
          result.value.indices.forEach(s => {
            if (s.type === 'stream') s.value.stop();
          });
          create();
          ({ result, canContinue } = run(create, info, args, space));
          output(result);
        }
      },
    };
  });
  return [0, 1, 2].map(i =>
    create(streamMap(([b]) => b.value.indices[i] || { type: 'nil' })([base])),
  );
};

export default combine;
