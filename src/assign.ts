import core, { streamMap } from './core';
import { fromJs, toIndex } from './data';
import listUtils from './list';

const getType = ([l, v, k], setNil, noDestructure, get) => {
  const list = get(l);
  if (list.type === 'value') return 'none';
  if (!k) {
    const value = get(v);
    if (value.type === 'nil') return 'none';
    return 'append';
  }
  const key = get(k);
  if (!setNil) {
    const value = get(v);
    if (value.type === 'nil') return 'none';
  }
  if (!noDestructure && key.type === 'list') {
    const value = get(v);
    if (value.type === 'list') return 'destructure';
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
  if (type === 'destructure') {
    return streamMap(([value, key], create) => {
      const keyPairs = listUtils.toPairs(key);
      const func = listUtils.getFunc(key);
      const { values, rest } = listUtils.extract(
        value,
        keyPairs.map(d => d.key),
        func && !func.isMap && !func.hasArg,
      );
      const result = values.reduce(
        (res, v, i) => create(assign([res, v, keyPairs[i].value], true, false)),
        l,
      );
      if (!func || func.isMap) return result;
      if (func.hasArg) {
        return create(
          streamMap(([list], create) => {
            const offset = list.value.indices[list.value.indices - 1] || 0;
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
                        })([func(create, k)[0]]),
                      ),
                    ],
                    true,
                    true,
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
        ),
      );
    })([v, k], [false, true]);
  }
  return streamMap(([list, key]) => listUtils.set(list, key, v))(
    [l, k],
    [false, true],
  );
};

const assign = (args, setNil, noDestructure) => ({ get, output, create }) => {
  let type = getType(args, setNil, noDestructure, get);
  let prev = create(run(type, args));
  return {
    initial: prev,
    update: () => {
      const nextType = getType(args, setNil, noDestructure, get);
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
