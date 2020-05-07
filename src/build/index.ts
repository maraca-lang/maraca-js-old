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
const mergeScope = (create, scope, current, clearIndices) => {
  if (scope.type === 'block' && current.type === 'block') {
    return mergeScopeBase(scope, current, clearIndices);
  }
  return create(
    streamMap((get) => mergeScopeBase(get(scope), get(current), clearIndices)),
  );
};

const build = (
  create,
  getScope,
  current,
  { type, info = {} as any, nodes = [] as any[] },
) => {
  if (type === 'block' && !['[', '<'].includes(info.bracket)) {
    return build(create, getScope, current, {
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
    const newScope = mergeScope(create, getScope(), current, true);
    let newBlock = { type: 'block', value: new Block() };
    nodes.forEach((n) => {
      if (['func', 'set', 'push'].includes(n.type)) {
        newBlock = buildEffect(create, () => newScope, newBlock, n);
      } else {
        newBlock = mergeStatic(
          create,
          [newBlock, build(create, () => newScope, newBlock, n)],
          ([l, v], get) => {
            const value = get(v);
            if (!value.value) return l;
            return { type: 'block', value: get(l).value.append(value) };
          },
        );
      }
    });
    return newBlock;
  }

  if (type === 'get') {
    return create(
      streamMap((get, create) =>
        combineRun(
          combineConfig(
            [
              mergeScope(create, getScope(), current, false),
              build(create, getScope, current, nodes[0]),
            ],
            get,
          ),
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
    nodes.map((n) => n && build(create, getScope, current, n)),
  );
};

export default build;
