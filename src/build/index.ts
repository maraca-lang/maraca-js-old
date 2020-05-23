import { combineConfig, combineRun } from '../combine';
import { createBlock } from '../utils/block';
import { streamMap } from '../utils/misc';

import buildBlock from './block';
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

  if (type === 'block') {
    let newScope;
    const getNewScope = () => {
      if (!newScope) {
        const scope = getScope();
        newScope = {
          type: 'block',
          value: {
            values: { ...scope.value.values, ...result.values },
            streams: [...scope.value.streams, ...result.streams],
            indices: [],
            ...(scope.value.unresolved || result.unresolved
              ? { unresolved: true }
              : {}),
          },
        };
      }
      return newScope;
    };
    const result = nodes.reduce(
      (res, n) => buildBlock(create, getNewScope, res, n),
      createBlock(),
    );
    return { type: 'block', value: result };
  }

  if (type === 'get') {
    const arg = build(create, getScope, nodes[0]);
    return {
      type: 'stream',
      value: create(
        streamMap((get, create) =>
          combineRun(combineConfig([getScope(), arg], get), get, create),
        ),
      ),
    };
  }

  const args = nodes.map((n) => n && build(create, getScope, n));
  return buildValue(create, type, info, args);
};

export default build;
