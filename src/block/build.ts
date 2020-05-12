import build from '../build/index';

import func from './func';
import { blockSet, createBlock, fromPairs, toPairs } from './util';

const pushable = (arg) => (set, get) => {
  const push = (v) => set({ ...v, push });
  return () => set({ push, ...get(arg) });
};
const snapshot = (create, { push, ...value }) => {
  const result =
    value.type !== 'block'
      ? value
      : {
          type: 'block',
          value: fromPairs(
            toPairs(value.value).map(({ key, value }) => ({
              key,
              value: snapshot(create, value),
            })),
          ),
        };
  return push ? create(pushable(result), true) : result;
};

export default (create, getScope, nodes) => {
  let result = { type: 'block', value: createBlock() };
  const getNewScope = () => {
    const scope = getScope();
    return {
      type: 'block',
      value: {
        values: { ...scope.value.values, ...result.value.values },
        streams: [...scope.value.streams, ...result.value.streams],
        indices: [],
      },
    };
  };

  nodes.forEach(({ type, info = {} as any, nodes = [] as any[] }) => {
    const args = nodes.map((n) => n && build(create, getNewScope, n));
    if (type === 'set') {
      if (info.pushable) args[0] = create(pushable(args[0]));
      result.value = (blockSet as any)(result.value, ...args);
    } else if (type === 'func') {
      if (args.every((a) => !a) && !info.map) {
        result.value.func = build(create, getNewScope, info.value);
      } else {
        const [value, isMap, isPure] = func(create, getNewScope, info, args);
        result.value.func = Object.assign(value, { isMap, isPure });
      }
    } else if (type === 'push') {
      result.value.indices.push(
        create((_, get, create) => {
          let source;
          return () => {
            const dest = get(args[1]);
            const newSource = get(args[0], true);
            if (source && dest.push && source !== newSource) {
              dest.push(snapshot(create, newSource));
            }
            source = newSource;
          };
        }),
      );
    } else if (type !== 'nil') {
      result.value.indices.push(
        build(create, getNewScope, { type, info, nodes }),
      );
    }
  });

  return result;
};
