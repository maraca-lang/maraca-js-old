import setFunc from '../block/func';
import { staticAppend, staticSet } from '../block/set';
import { createBlock } from '../utils';

import buildValue from './values';

const build = (create, getScope, node) =>
  buildBase(null, null, node) || (create && buildBase(create, getScope, node));

const buildBase = (
  create,
  getScope,
  { type, info = {} as any, nodes = [] as any[] },
) => {
  if (type === 'block' && !['[', '<'].includes(info.bracket)) {
    const index =
      info.bracket === '{'
        ? 1
        : nodes.filter(
            (n) => !['func', 'set', 'push', 'nil', 'error'].includes(n.type),
          ).length;
    return build(create, getScope, {
      type: 'combine',
      nodes: [
        { type: 'value', info: { value: `${index}` } },
        { type: 'block', info: { bracket: '[' }, nodes },
      ],
    });
  }

  if (type === 'get') {
    return build(create, getScope, {
      type: 'combine',
      nodes: [{ type: 'scope' }, nodes[0]],
    });
  }

  if (type === 'block') {
    let newScope;
    const getNewScope =
      getScope &&
      (() => {
        if (!newScope) {
          const scope = getScope();
          newScope = {
            values: { ...scope.values, ...result.values },
            streams: [...scope.streams, ...result.streams],
            indices: [],
            ...(scope.unresolved || result.unresolved
              ? { unresolved: true }
              : {}),
          };
        }
        return newScope;
      });
    const result = nodes.reduce(
      (block, { type, info = {} as any, nodes = [] as any[] }) => {
        if (!block) return null;
        if (type === 'set' || type === 'func') {
          const newNodes = [...nodes];
          if (type === 'set' && info.pushable) {
            newNodes[0] = { type: 'pushable', nodes: [nodes[0]] };
          }
          const args = newNodes.map((n) => n && build(create, getNewScope, n));
          if (args.some((a, i) => nodes[i] && !a)) return null;
          if (type === 'set') return (staticSet as any)(block, ...args);
          else return setFunc(block, create, getNewScope, info, args);
        }
        const value = build(create, getNewScope, { type, info, nodes });
        return value && staticAppend(block, value);
      },
      createBlock(),
    );
    return result && { type: 'block', value: result };
  }

  if (type === 'scope') {
    if (!create) return null;
    return {
      type: 'stream',
      value: create((set) => set({ type: 'block', value: getScope() })),
    };
  }

  const args = nodes.map((n) => build(create, getScope, n));
  if (!args.every((x) => x)) return null;
  return buildValue(create, type, info, args);
};

export default build;
