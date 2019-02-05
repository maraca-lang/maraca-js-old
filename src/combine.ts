import assign from './assign';
import { streamMap } from './core';
import { compare, toData, toKey } from './data';

const sortTypes = (v1, v2) => {
  if (v2.type === 'nil') return [v1, v2];
  if (v1.type === 'nil') return [v2, v1];
  if (v2.type === 'value') return [v1, v2];
  if (v1.type === 'value') return [v2, v1];
  if (!v2.value.other) return [v1, v2];
  if (!v1.value.other) return [v2, v1];
  if (v2.value.otherMap) return [v1, v2];
  if (v1.value.otherMap) return [v2, v1];
  return [null, null];
};

const getType = (big, small) => {
  if (big === null && small === null) return 'nil';
  if (small.type === 'list' && (!big.value.other || big.value.otherMap)) {
    return 'multi';
  }
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

const run = (create, { type, reverse, big, small }, [s1, s2], dot, space) => {
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
            toData(
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
  const keys = [
    ...Array.from({
      length: Math.max(big.value.indices.length, small.value.indices.length),
    }).map((_, i) => toData(i + 1)),
    ...Array.from(
      new Set([
        ...Object.keys(big.value.values),
        ...Object.keys(small.value.values),
      ]),
    ).map(k => (big.value.values[k] || small.value.values[k]).key),
  ].sort(compare);
  const pairs = keys
    .map(k => [big, small].map(v => listGet(v, k, true)))
    .filter(([b, s]) => {
      if (typeof b === 'function') return s.type !== 'nil';
      if (typeof s === 'function') return b.type !== 'nil';
      return b.type !== 'nil' || s.type !== 'nil';
    });
  if (
    big.value.otherMap === 'pure' &&
    pairs.every(([b]) => b === big.value.other)
  ) {
    return {
      result: toList([
        {
          type: 'list',
          value: pairs.reduce(
            (res, [b, s], i) => {
              const next = { ...res };
              const objKey = toKey(keys[i]);
              const value = combine(
                create,
                [
                  {
                    type: 'list',
                    value: {
                      indices: [],
                      values: {},
                      other: b(undefined, undefined, keys[i]),
                    },
                  },
                  s,
                ],
                dot,
                space,
              )[0];
              if (typeof objKey === 'number') {
                next.indices = [...next.indices];
                next.indices[objKey] = value;
              } else {
                next.values = { ...next.values };
                next.values[objKey] = { key: keys[i], value };
              }
              return next;
            },
            { indices: [], values: {} } as any,
          ),
        },
      ]),
    };
  }
  return {
    result: toList([
      pairs.reduce(
        (res, p, i) => {
          const [b, s] = p.map(v => {
            if (typeof v !== 'function') return v;
            return {
              type: 'list',
              value: { indices: [], values: {}, other: v(...res, keys[i]) },
            };
          });
          const [v, scope, current] = combine(
            create,
            reverse ? [s, b] : [b, s],
            dot,
            space,
          );
          return [scope, create(assign([current, v, keys[i]], false, false))];
        },
        [undefined, { type: 'list', value: { indices: [], values: {} } }],
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
      dot,
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
          ({ result, canContinue } = run(create, info, args, dot, space));
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
