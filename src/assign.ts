import { fromJs, toIndex } from './data';
import { streamMap } from './util';

const getType = ([l, v, k], setNil, noDestructure, append, get) => {
  const block = get(l);
  if (block.type === 'value' && block.value) return 'none';
  if (!k && append) {
    const value = get(v);
    if (!value.value) return 'none';
    return 'append';
  }
  if (!setNil) {
    const value = get(v);
    if (!value.value) return 'none';
  }
  const key = k && get(k);
  if (!noDestructure && (!key || key.type === 'block')) {
    const value = get(v);
    if (value.type === 'block') return 'destructure';
  }
  return 'set';
};

const run = (type, [l, v, k]) => {
  if (type === 'none') {
    return (set) => set(l);
  }
  if (type === 'append') {
    return streamMap(([block]) => ({
      type: 'block',
      value: block.value.append(v),
    }))([l]);
  }
  if (type === 'destructure') {
    return streamMap(([value, key], create) => {
      const keyPairs = key ? key.value.toPairs() : [];
      const func = key ? key.value.getFunc() : { hasArg: true };
      const { values, rest } = value.value.extract(
        keyPairs.map((d) => d.key),
        func && !func.isMap && !func.hasArg,
      );
      const result = values.reduce(
        (res, v, i) =>
          create(assign([res, v, keyPairs[i].value], true, false, false)),
        l,
      );
      if (!func || func.isMap) return result;
      if (func.hasArg) {
        return create(
          streamMap(([block], create) => {
            const offset =
              block.value.indices[block.value.indices.length - 1] || 0;
            return rest.toPairs().reduce(
              (res, { key: k, value: v }) =>
                create(
                  assign(
                    [
                      res,
                      v,
                      create(
                        streamMap(([x]) => {
                          if (x.type === 'value') {
                            const index = toIndex(x.value);
                            if (index) return fromJs(index + offset);
                          }
                          return x;
                        })([key ? func(create, k)[0] : k]),
                      ),
                    ],
                    true,
                    true,
                    false,
                  ),
                ),
              result,
            );
          })([l]),
        );
      }
      return create(
        assign(
          [
            result,
            { type: 'block', value: rest },
            func(create, { type: 'value', value: '' })[0],
          ],
          true,
          true,
          false,
        ),
      );
    })(k ? [v, k] : [v], [false, true]);
  }
  return streamMap(([block, key]) => ({
    type: 'block',
    value: block.value.set(key, v),
  }))([l, k || { type: 'value', value: '' }], [false, true]);
};

const assign = (args, setNil, noDestructure, append) => (set, get, create) => {
  let type;
  let prev;
  return () => {
    const nextType = getType(args, setNil, noDestructure, append, get);
    if (nextType !== type) {
      type = nextType;
      if (prev && !args.includes(prev)) prev.value.cancel();
      prev = create(run(type, args));
      set(prev);
    }
  };
};

export default assign;
