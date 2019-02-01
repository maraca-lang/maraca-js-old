import { streamMap } from './core';
import { toData, toKey } from './data';
import { createIndexer } from './process';

const getType = ([l, v, k], unpack, setNil, get) => {
  const list = get(l);
  if (list.type === 'value') return 'none';
  if (!k) {
    const value = get(v);
    if (value.type === 'nil') return 'none';
    if (!unpack || value.type === 'value') return 'append';
    return 'merge';
  }
  const key = get(k);
  if (!setNil) {
    const value = get(v);
    if (value.type === 'nil') return 'none';
  }
  if (unpack && key.type === 'list') {
    const value = get(v);
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
      const rest = {
        indices: [...value.value.indices],
        values: { ...value.value.values },
      };
      const removed = [] as any[];
      const result = [
        ...key.value.indices.map((v, i) => ({ key: toData(i + 1), value: v })),
        ...Object.keys(key.value.values).map(k => key.value.values[k]),
      ].reduce((res, d) => {
        const k = toKey(d.key);
        let v;
        if (typeof k === 'number') {
          v = value.value.indices[k];
          removed.push(k);
        } else {
          v = value.value.values[k] && value.value.values[k].value;
          delete rest.values[k];
        }
        return assign(
          create,
          subIndexer(),
          [res, v || { type: 'nil' }, d.value],
          true,
          true,
        );
      }, l);
      if (key.value.other && !key.value.otherMap) {
        removed.sort((a, b) => b - a);
        removed.forEach(k => rest.indices.splice(k, 1));
        const k = key.value.other(subIndexer(), { type: 'nil' })[0];
        return assign(
          create,
          subIndexer(),
          [result, { type: 'list', value: rest }, k],
          true,
          true,
        );
      }
      return result;
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

const assign = (create, index, args, unpack, setNil) =>
  create(index, ({ get, output }) => {
    let type = getType(args, unpack, setNil, get);
    let prev = run(create, createIndexer(index), type, args);
    return {
      initial: prev,
      update: () => {
        const nextType = getType(args, unpack, setNil, get);
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
