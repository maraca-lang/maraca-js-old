import core, { streamMap } from './core';
import listUtils from './list';

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

const run = (type, [l, v, k]) => {
  if (type === 'none') {
    return core.settable(l);
  }
  if (type === 'append') {
    return streamMap(([list]) => listUtils.append(list, v))([l]);
  }
  if (type === 'merge') {
    return streamMap(([list, value]) => listUtils.merge(list, value))([l, v]);
  }
  if (type === 'destructure') {
    return streamMap(([value, key], create) => {
      const keyPairs = listUtils.toPairs(key);
      const { values, rest } = listUtils.extract(
        value,
        keyPairs.map(d => d.key),
      );
      const result = values.reduce(
        (res, v, i) => create(assign([res, v, keyPairs[i].value], true, true)),
        l,
      );
      const func = listUtils.getFunc(key);
      if (!func || func.isMap) return result;
      const k = listUtils.getFunc(key)(create, { type: 'nil' })[0];
      return create(
        assign([result, { type: 'list', value: rest }, k], true, true),
      );
    })([v, k], [false, true]);
  }
  return streamMap(([list, key]) => listUtils.set(list, key, v))(
    [l, k],
    [false, true],
  );
};

const assign = (args, unpack, setNil) => ({ get, output, create }) => {
  let type = getType(args, unpack, setNil, get);
  let prev = create(run(type, args));
  return {
    initial: prev,
    update: () => {
      const nextType = getType(args, unpack, setNil, get);
      if (nextType !== type) {
        type = nextType;
        if (!args.includes(prev)) prev.value.stop();
        create();
        prev = create(run(type, args));
        output(prev);
      }
    },
  };
};

export default assign;
