import assign from './assign';
import { compare, listGet, toData, toKey } from './data';
import { streamMap } from './core';
import { createIndexer } from './process';

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

const getInfo = ([s1, s2], get) => {
  const v1 = get(s1);
  const v2 = get(s2);
  const [big, small] = sortTypes(v1, v2);
  return { type: getType(big, small), reverse: big !== v1, big, small };
};

const toList = indices => ({
  type: 'list',
  value: { indices, values: {} },
});

const copy = (create, index, stream) =>
  create(index, ({ get, output }) => ({
    initial: get(stream),
    update: () => output(get(stream)),
  }));

const run = (
  create,
  indexer,
  { type, reverse, big, small },
  [s1, s2],
  space,
) => {
  if (type === 'nil') {
    return {
      result: toList([{ type: 'nil' }]),
      canContinue: info => info.type === 'nil',
    };
  }
  if (type === 'join') {
    return {
      result: toList([
        streamMap((v1, v2) =>
          toData(
            (v1.value || '') +
              (v1.value && v2.value && space ? ' ' : '') +
              (v2.value || ''),
          ),
        )(create, indexer(), [s1, s2]),
      ]),
      canContinue: info => info.type === 'join',
    };
  }
  if (type === 'get') {
    const value = listGet(big, small);
    const result =
      typeof value !== 'function'
        ? [value]
        : value(indexer(), reverse ? s1 : s2);
    if (result[0].type === 'stream') {
      result[0] = copy(create, indexer(), result[0]);
    }
    return {
      result: toList(result),
      canContinue: info =>
        info.type === 'get' && listGet(info.big, info.small) === value,
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
    )
      .map(k => (big.value.values[k] || small.value.values[k]).key)
      .sort(compare),
  ];
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
                indexer(),
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
            indexer(),
            reverse ? [s, b] : [b, s],
            space,
          );
          return [
            scope,
            assign(create, indexer(), [current, v, keys[i]], false, false),
          ];
        },
        [undefined, { type: 'list', value: { indices: [], values: {} } }],
      )[1],
    ]),
  };
};

const combine = (create, index, args, space) => {
  const indexer = createIndexer(index);
  const baseIndex = indexer();
  const base = create(baseIndex, ({ get, output }) => {
    let { result, canContinue } = run(
      create,
      createIndexer(baseIndex),
      getInfo(args, get),
      args,
      space,
    );
    return {
      initial: result,
      update: () => {
        const info = getInfo(args, get);
        if (!canContinue || !canContinue(info)) {
          result.value.indices.forEach(s => {
            if (s.type === 'stream') s.value.stop();
          });
          ({ result, canContinue } = run(
            create,
            createIndexer(baseIndex),
            info,
            args,
            space,
          ));
          output(result);
        }
      },
    };
  });
  return [0, 1, 2].map(i =>
    streamMap(b => b.value.indices[i] || { type: 'nil' })(create, indexer(), [
      base,
    ]),
  );
};

export default combine;
