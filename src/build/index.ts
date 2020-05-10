import buildBlock from '../block/build';
import { combineConfig, combineRun } from '../block/combine';
import { streamMap } from '../util';

import buildValue from './values';

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

  if (type === 'block') {
    return buildBlock(create, getScope, nodes);
  }

  return buildValue(
    create,
    type,
    info,
    nodes.map((n) => n && build(create, getScope, n)),
  );
};

export default build;
