import { streamMap } from './build';
import { fromJs, toIndex } from './data';
import listUtils from './list';

const getType = ([l, v, k], setNil, noDestructure, append, get) => {
  const list = get(l);
  if (list.type === 'value') return 'none';
  if (!k && append) {
    const value = get(v);
    if (value.type === 'nil') return 'none';
    return 'append';
  }
  if (!setNil) {
    const value = get(v);
    if (value.type === 'nil') return 'none';
  }
  const key = k && get(k);
  if (!noDestructure && (!key || key.type === 'list')) {
    const value = get(v);
    if (value.type === 'list') return 'destructure';
  }
  return 'set';
};

const run = (type, [l, v, k]) => {
  if (type === 'none') {
    return () => ({ initial: l });
  }
  if (type === 'append') {
    return streamMap(([list]) => listUtils.append(list, v))([l]);
  }
  if (type === 'destructure') {
    return streamMap(([value, key], create) => {
      const keyPairs = key ? listUtils.toPairs(key) : [];
      const func = key ? listUtils.getFunc(key) : { hasArg: true };
      const { values, rest } = listUtils.extract(
        value,
        keyPairs.map(d => d.key),
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
          streamMap(([list], create) => {
            const offset =
              list.value.indices[list.value.indices.length - 1] || 0;
            return listUtils.toPairs({ type: 'list', value: rest }).reduce(
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
            { type: 'list', value: rest },
            func(create, { type: 'nil' })[0],
          ],
          true,
          true,
          false,
        ),
      );
    })(k ? [v, k] : [v], [false, true]);
  }
  return streamMap(([list, key]) => listUtils.set(list, key, v))(
    [l, k || { type: 'nil' }],
    [false, true],
  );
};

const assign = (args, setNil, noDestructure, append) => ({
  get,
  output,
  create,
}) => {
  let type = getType(args, setNil, noDestructure, append, get);
  let prev = create(run(type, args));
  return {
    initial: prev,
    update: () => {
      const nextType = getType(args, setNil, noDestructure, append, get);
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
