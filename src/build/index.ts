import setFunc from '../block/func';
import { staticAppend, staticSet } from '../block/set';
import { createBlock, pushable } from '../utils';

import buildValue from './values';

const build = (
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
    const getNewScope = () => {
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
    };
    const result = nodes.reduce(
      (block, { type, info = {} as any, nodes = [] as any[] }) => {
        const args = nodes.map((n) => n && build(create, getNewScope, n));
        if (type === 'set') {
          if (info.pushable) {
            args[0] = { type: 'stream', value: create(pushable(args[0])) };
          }
          return (staticSet as any)(block, ...args);
        }
        if (type === 'func') {
          return setFunc(block, create, getNewScope, info, args);
        }
        return staticAppend(
          block,
          build(create, getNewScope, { type, info, nodes }),
        );
      },
      createBlock(),
    );
    return { type: 'block', value: result };
  }

  if (type === 'scope') {
    return {
      type: 'stream',
      value: create((set) => set({ type: 'block', value: getScope() })),
    };
  }

  const args = nodes.map((n) => n && build(create, getScope, n));
  return buildValue(create, type, info, args);
};

export default build;
