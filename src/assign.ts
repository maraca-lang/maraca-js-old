import { streamMap } from './core';
import { listGet, toData, toKey } from './data';
import { createIndexer } from './process';

const getType = (unpack, args, get) => {
  const [list, value, key] = args.map(a => a && get(a));
  if (list.type === 'value') return 'none';
  if (!key) {
    if (value.type === 'nil') return 'none';
    if (!unpack || value.type === 'value') return 'append';
    return 'merge';
  }
  if (unpack && key.type === 'list') {
    if (value.type !== 'list') return 'none';
    return 'destructure';
  }
  return 'set';
};

const run = (create, indexer, type, [l, v, k]) => {
  if (type === 'none') {
    return l;
  }
  if (type === 'append') {
    return streamMap(list => {
      const listValue = list.value || { indices: [], values: {} };
      return {
        type: 'list',
        value: { ...listValue, indices: [...listValue.indices, v] },
      };
    })(create, indexer(), [l]);
  }
  if (type === 'merge') {
    return streamMap((list, value) => {
      const listValue = list.value || { indices: [], values: {} };
      return {
        type: 'list',
        value: {
          ...listValue,
          indices: [...listValue.indices, ...value.value.indices],
          values: { ...listValue.values, ...value.value.values },
        },
      };
    })(create, indexer(), [l, v]);
  }
  if (type === 'destructure') {
    const index = indexer();
    return streamMap((value, key) => {
      const subIndexer = createIndexer(index);
      return [
        ...key.value.indices.map((v, i) => ({ key: toData(i + 1), value: v })),
        ...Object.keys(key.value.values).map(k => key.value.values[k]),
      ].reduce((res, d) => {
        return assign(true)(create, subIndexer(), [
          res,
          listGet(value, d.key),
          d.value,
        ]);
      }, l);
    })(create, indexer(), [v, k]);
  }
  return streamMap((list, key) => {
    const listValue = list.value || { indices: [], values: {} };
    const res = { ...listValue };
    const objKey = toKey(key);
    if (typeof objKey === 'number') {
      res.indices = [...res.indices];
      res.indices[objKey] = v;
    } else {
      res.values = { ...res.values };
      res.values[objKey] = { key, value: v };
    }
    return { type: 'list', value: res };
  })(create, indexer(), [l, k]);
};

const assign = unpack => (create, index, args) =>
  create(index, ({ get, output }) => {
    let type = getType(unpack, args, get);
    let prev = run(create, createIndexer(index), type, args);
    return {
      initial: prev,
      update: () => {
        const nextType = getType(unpack, args, get);
        if (nextType !== type) {
          type = nextType;
          if (!args.includes(prev)) prev.value.stop();
          prev = run(create, createIndexer(index), type, args);
          output(prev);
        }
      },
    };
  });

export default assign;
