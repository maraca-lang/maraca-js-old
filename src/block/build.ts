import build from '../build/index';
import mergeStatic from '../build/static';
import { streamMap } from '../util';

import { cloneBlock, createBlock, fromPairs, toPairs } from './util';

import func from './func';
import set from './set';

const mergeScope = (scope, newBlock) => ({
  type: 'block',
  value: {
    values: { ...scope.value.values, ...newBlock.value.values },
    indices: [],
  },
});

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

const withStream = (value, stream) => (set, get) => {
  get(stream);
  set(value);
};

const setFunc = (block, func, isMap?, isPure?) => {
  const result = cloneBlock(block);
  result.func =
    typeof func === 'function' ? Object.assign(func, { isMap, isPure }) : func;
  return result;
};

export default (create, getScope, nodes) => {
  let newBlock = { type: 'block', value: createBlock() };
  const getNewScope = () => {
    const scope = getScope();
    if (scope.type === 'block' && newBlock.type === 'block') {
      return mergeScope(scope, newBlock);
    }
    return create(streamMap((get) => mergeScope(get(scope), get(newBlock))));
  };

  nodes
    .filter((n) => n.type === 'set' && n.nodes[1])
    .forEach(({ info, nodes }) => {
      const key = build(create, getNewScope, nodes[1]);
      const value = build(
        create,
        key.type === 'value' ? getNewScope : getScope,
        nodes[0],
      );
      const assignArgs = [newBlock, value, key];
      if (info.pushable) assignArgs[1] = create(pushable(assignArgs[1]));
      newBlock = mergeStatic(create, assignArgs, set(false));
    });

  let result = newBlock;
  nodes
    .filter((n) => !(n.type === 'set' && n.nodes[1]))
    .forEach(({ type, info, nodes }) => {
      if (type === 'set') {
        const value = build(create, getNewScope, nodes[0]);
        const assignArgs = [result, value];
        if (info.pushable) assignArgs[1] = create(pushable(assignArgs[1]));
        result = mergeStatic(create, assignArgs, set(false));
      } else if (type === 'func') {
        const prev = result;
        const args = nodes.map((n) => n && build(create, getNewScope, n));
        if (args.every((a) => !a) && !info.map) {
          const value = build(create, getNewScope, info.value);
          result = mergeStatic(create, [prev, value], ([c, v], get) => ({
            type: 'block',
            value: setFunc(get(c).value, get(v)),
          }));
        } else {
          const funcArgs = func(create, getNewScope, info, args);
          result = create(
            streamMap((get) => ({
              type: 'block',
              value: (setFunc as any)(get(prev).value, ...funcArgs),
            })),
          );
        }
      } else if (type === 'push') {
        const args = nodes.map((n) => n && build(create, getNewScope, n));
        const stream = create((_, get, create) => {
          let source;
          return () => {
            const dest = get(args[1]);
            const newSource = get(args[0], true);
            if (source && dest.push && source !== newSource) {
              dest.push(snapshot(create, newSource));
            }
            source = newSource;
          };
        });
        result = create(withStream(result, stream));
      } else {
        result = mergeStatic(
          create,
          [result, build(create, getNewScope, { type, info, nodes })],
          ([l, v], get) => {
            const value = get(v);
            if (!value.value) return l;
            const result = cloneBlock(get(l).value);
            result.indices.push(value);
            return { type: 'block', value: result };
          },
        );
      }
    });
  return result;
};
