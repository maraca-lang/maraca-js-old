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
        : nodes.filter((n) => !['func', 'set', 'push', 'nil'].includes(n.type))
            .length;
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
    return {
      type: 'stream',
      value: create(
        streamMap((get, create) =>
          combineRun(
            combineConfig([getScope(), build(create, getScope, nodes[0])], get),
            get,
            create,
          ),
        ),
      ),
    };
  }

  const args = nodes.map((n) => n && build(create, getScope, n));
  return buildValue(create, type, info, args);
};

export default build;
