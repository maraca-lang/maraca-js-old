import Block from '../block/block';
import { combineConfig, combineRun } from '../block/combine';
import buildEffect from '../block/effects';
import { streamMap } from '../util';

import mergeStatic from './static';
import buildValue from './values';

const mergeScope = (scope, newBlock) => ({
  type: 'block',
  value: Block.fromPairs([
    ...scope.value.toPairs(),
    ...newBlock.value.toPairs(),
  ]).clearIndices(),
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
          value: Block.fromPairs(
            value.value.toPairs().map(({ key, value }) => ({
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

const build = (
  create,
  getScope,
  { type, info = {} as any, nodes = [] as any[] },
) => {
  if (type === 'block' && !['[', '<'].includes(info.bracket)) {
    return build(create, getScope, {
      type: 'combine',
      nodes: [
        {
          type: 'value',
          info: {
            value: `${
              info.bracket === '('
                ? nodes.filter(
                    (n) => !['func', 'set', 'push', 'nil'].includes(n.type),
                  ).length
                : 1
            }`,
          },
        },
        { type: 'block', info: { bracket: '[' }, nodes },
      ],
    });
  }
  if (type === 'block') {
    let newBlock = { type: 'block', value: new Block() };
    const getNewScope = () => {
      const scope = getScope();
      if (scope.type === 'block' && newBlock.type === 'block') {
        return mergeScope(scope, newBlock);
      }
      return create(streamMap((get) => mergeScope(get(scope), get(newBlock))));
    };
    nodes
      .filter((n) => n.type === 'set' && n.nodes[1])
      .forEach(({ type, info, nodes }) => {
        const key = build(create, getNewScope, nodes[1]);
        const value = build(
          create,
          key.type === 'value' ? getNewScope : getScope,
          nodes[0],
        );
        newBlock = buildEffect(create, getNewScope, newBlock, {
          type,
          info,
          args: [value, key],
        });
      });
    let result = newBlock;
    nodes
      .filter((n) => !(n.type === 'set' && n.nodes[1]))
      .forEach(({ type, info, nodes }) => {
        if (['func', 'set'].includes(type)) {
          const args = nodes.map((n) => n && build(create, getNewScope, n));
          result = buildEffect(create, getNewScope, result, {
            type,
            info,
            args,
          });
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
              return { type: 'block', value: get(l).value.append(value) };
            },
          );
        }
      });
    return result;
  }

  if (type === 'get') {
    return create(
      streamMap((get, create) =>
        combineRun(
          combineConfig([getScope(), build(create, getScope, nodes[0])], get),
          get,
          create,
        ),
      ),
    );
  }

  return buildValue(
    create,
    type,
    info,
    nodes.map((n) => n && build(create, getScope, n)),
  );
};

export default build;
