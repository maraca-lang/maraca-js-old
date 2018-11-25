import assign from './assign';
import { compare, listGet, toData } from './data';
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

const run = (
  create,
  indexer,
  { type, reverse, big, small },
  [s1, s2],
  tight,
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
              (v1.value && v2.value && !tight ? ' ' : '') +
              (v2.value || ''),
          ),
        )(create, indexer(), [s1, s2]),
      ]),
      canContinue: info => info.type === 'join',
    };
  }
  if (type === 'get') {
    const value = listGet(big, small);
    return {
      result: toList(
        typeof value !== 'function'
          ? [value]
          : value(indexer(), reverse ? s1 : s2),
      ),
      canContinue: info =>
        info.type === 'get' && listGet(info.big, info.small) === value,
    };
  }
  return {
    result: toList([
      [
        ...Array.from({
          length: Math.max(
            big.value.indices.length,
            small.value.indices.length,
          ),
        }).map((_, i) => toData(i + 1)),
        ...Array.from(
          new Set([
            ...Object.keys(big.value.values),
            ...Object.keys(small.value.values),
          ]),
        )
          .map(k => (big.value.values[k] || small.value.values[k]).key)
          .sort(compare),
      ].reduce(
        (res, k) => {
          const [b, s] = [big, small]
            .map(v => listGet(v, k))
            .map(v => {
              if (typeof v !== 'function') return v;
              return {
                type: 'list',
                value: { indices: [], values: {}, other: v(res, k) },
              };
            });
          const [v, l] = combine(
            create,
            indexer(),
            reverse ? [s, b] : [b, s],
            tight,
          );
          return assign(create, indexer(), [l, v, k], false, false);
        },
        { type: 'nil' },
      ),
    ]),
  };
};

const combine = (create, index, args, tight) => {
  const indexer = createIndexer(index);
  const baseIndex = indexer();
  const base = create(baseIndex, ({ get, output }) => {
    let { result, canContinue } = run(
      create,
      createIndexer(baseIndex),
      getInfo(args, get),
      args,
      tight,
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
            tight,
          ));
          output(result);
        }
      },
    };
  });
  return [0, 1].map(i =>
    streamMap(b => b.value.indices[i] || { type: 'nil' })(create, indexer(), [
      base,
    ]),
  );
};

export default combine;
