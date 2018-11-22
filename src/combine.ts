import { compare, listGet, listOrNull, toData, toKey } from './data';
import { streamMap } from './core';
import { createIndexer } from './process';

const sortTypes = (v1, v2) => {
  if (v2.type === 'nil') return [v1, v2];
  if (v1.type === 'nil') return [v2, v1];
  if (v2.type === 'value') return [v1, v2];
  if (v1.type === 'value') return [v2, v1];
  if (!v2.value.other) return [v1, v2];
  if (!v1.value.other) return [v2, v1];
  if (!['=>', 'k=>'].includes(v2.value.otherType)) return [v1, v2];
  if (!['=>', 'k=>'].includes(v1.value.otherType)) return [v2, v1];
  return [v1, v2];
};

const getType = (big, small) => {
  if (small.type === 'list') {
    return ['=>', 'k=>'].includes(big.value.otherType) ? 'get' : 'multi';
  }
  if (big.type === 'list') return 'get';
  return 'join';
};

const getInfo = (s1, s2, get) => {
  const v1 = get(s1);
  const v2 = get(s2);
  const [big, small] = sortTypes(v1, v2);
  return { type: getType(big, small), reverse: big !== v1, big, small };
};

const assign = (list = { indices: [], values: {} } as any, value, key) => {
  if (!key) {
    if (value.type === 'nil') return list;
    return listOrNull({ ...list, indices: [...list.indices, value] });
  }
  const k = toKey(key);
  if (typeof k === 'number') {
    const indices = [...list.indices];
    if (value.type === 'nil') delete indices[k];
    else indices[k] = value;
    return listOrNull({ ...list, indices });
  }
  return listOrNull({
    ...list,
    values: { ...list.values, [k]: { key, value } },
  });
};

const run = (
  create,
  indexer,
  { type, reverse, big, small },
  s1,
  s2,
  tight,
  get,
  output,
) => {
  if (type === 'join') {
    return {
      result: streamMap((v1, v2) =>
        toData(
          (v1.value || '') +
            (v1.value && v2.value && !tight ? ' ' : '') +
            (v2.value || ''),
        ),
      )(create, indexer(), [s1, s2]),
      canContinue: info => info.type === 'join',
    };
  }
  if (type === 'get') {
    const value = listGet(big, small);
    if (typeof value !== 'function') {
      return {
        result: value,
        canContinue: info =>
          info.type === 'get' && listGet(info.big, info.small) === value,
      };
    }
    if (!['=>', 'k=>'].includes(big.value.otherType)) {
      return {
        result: { type: 'nil' },
        canContinue: info =>
          info.type === 'get' &&
          typeof listGet(info.big, info.small) === 'function' &&
          !['=>', 'k=>'].includes(info.big.value.otherType),
      };
    }
    const args = [{ type: 'nil' }];
    if (big.value.otherType === 'k=>') args.push(reverse ? s1 : s2);
    return {
      result: value(indexer(), args)[1],
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
  const values = [] as any;
  const runMulti = first => {
    for (let i = first; i < keys.length; i++) {
      const prev = values[i - 1] ? values[i - 1].combined : { type: 'nil' };
      const bigValue = listGet(big, keys[i]);
      const smallValue = listGet(small, keys[i]);
      if (typeof bigValue === 'function') {
        const args = [prev];
        if (big.value.otherType === 'k=>v=>') args.push(keys[i], smallValue);
        if (big.value.otherType === 'v=>>') args.push(smallValue);
        if (big.value.otherType === 'k=>') args.push(keys[i]);
        const res = bigValue(indexer(), args);
        values[i] = {
          result: res[0],
          value: res[1],
          combined: streamMap((list, val) =>
            val.type === 'nil' ? list : assign(list.value, val, keys[i]),
          )(create, indexer(), res),
        };
      } else {
        const { initial } = (combine as any)(
          create,
          indexer(),
          ...(reverse ? [smallValue, bigValue] : [bigValue, smallValue]),
          tight,
          get,
          value => {
            values[i].value = value;
            values[i].combined = streamMap((list, val) =>
              assign(list.value, val, keys[i]),
            )(create, indexer(), [values[i].result, values[i].value]);
            output(runMulti(i + 1));
          },
        );
        values[i] = {
          result: prev,
          value: initial,
          combined: streamMap((list, val) => assign(list.value, val, keys[i]))(
            create,
            indexer(),
            [prev, initial],
          ),
        };
      }
    }
    return values[keys.length - 1].combined;
  };
  return { result: runMulti(0) };
};

const combine = (create, index, s1, s2, tight, get, output) => {
  let { result, canContinue } = run(
    create,
    createIndexer(index),
    getInfo(s1, s2, get),
    s1,
    s2,
    tight,
    get,
    output,
  );
  return {
    initial: result,
    update: () => {
      const info = getInfo(s1, s2, get);
      if (!canContinue || !canContinue(info)) {
        ({ result, canContinue } = run(
          create,
          createIndexer(index),
          info,
          s1,
          s2,
          tight,
          get,
          output,
        ));
        output(result);
      }
    },
  };
};

export default combine;
