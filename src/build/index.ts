import Block from '../block';
import { combineConfig, combineRun } from '../combine';
import { streamMap } from '../util';

import buildEffect from './effects';
import mergeStatic from './static';
import buildValue from './values';

const mergeScopeBase = (scope, current, clearIndices) => {
  const result = Block.fromPairs([
    ...scope.value.toPairs(),
    ...current.value.toPairs(),
  ]);
  return {
    type: 'block',
    value: clearIndices ? result.clearIndices() : result,
  };
};
const mergeScope = (create, { scope, current }, clearIndices) => {
  if (scope.type === 'block' && current.type === 'block') {
    return mergeScopeBase(scope, current, clearIndices);
  }
  return create(
    streamMap((get) => mergeScopeBase(get(scope), get(current), clearIndices)),
  );
};

const build = (
  create,
  context,
  { type, info = {} as any, nodes = [] as any[] },
) => {
  if (type === 'block' && !['[', '<'].includes(info.bracket)) {
    return build(create, context, {
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
    const ctx = {
      scope: mergeScope(create, context, true),
      current: { type: 'block', value: new Block() },
    };
    nodes.forEach((n) => {
      if (['func', 'set', 'push'].includes(n.type)) {
        ctx.current = buildEffect(create, ctx, n);
      } else {
        ctx.current = mergeStatic(
          create,
          [ctx.current, build(create, ctx, n)],
          ([l, v], get) => {
            const value = get(v);
            if (!value.value) return l;
            return { type: 'block', value: get(l).value.append(value) };
          },
        );
      }
    });
    return ctx.current;
  }

  if (type === 'get') {
    return mergeStatic(
      create,
      [mergeScope(create, context, false), build(create, context, nodes[0])],
      combineConfig,
      combineRun,
    );
  }

  return buildValue(
    create,
    type,
    info,
    nodes.map((n) => n && build(create, context, n)),
  );
};

export default build;
