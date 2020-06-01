import setFunc from '../block/func';
import { staticAppend, staticSet } from '../block/set';
import { createBlock, memo, printValue } from '../utils';

import buildValue from './values';

const build = (create, getScope, node) => {
  if (!create) return buildBase(create, getScope, node);
  return (
    buildBase(null, null, node) || {
      type: 'build',
      value: memo(() => buildBase(create, getScope, node)),
    }
  );
};

const buildBase = (
  create,
  getScope,
  { type, info = {} as any, nodes = [] as any[] },
) => {
  if (type === 'built') return info.value;

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
    if (!create && getScope) {
      const small = build(null, null, nodes[0]);
      if (small && small.type === 'value') {
        const block = getScope();
        const k = printValue(small.value);
        const v = block.values[k] && block.values[k].value;
        return v || null;
      }
    }
    return build(create, getScope, {
      type: 'combine',
      nodes: [{ type: 'scope' }, nodes[0]],
    });
  }

  if (type === 'block') {
    const getNewScope = create
      ? memo(() => {
          const scope = getScope();
          return {
            values: result.values,
            streams: [
              ...result.streams.filter((x) => x.key),
              ...Object.keys(scope.values).map((k) => scope.values[k]),
              ...scope.streams.filter((x) => x.key),
            ],
            indices: [],
            ...(scope.unresolved || result.unresolved
              ? { unresolved: true }
              : {}),
          };
        })
      : getScope;
    const result = nodes.reduce(
      (block, { type, info = {} as any, nodes = [] as any[] }) => {
        if (!block) return null;
        if (type === 'copy') {
          const key = build(create, getScope, nodes[0]);
          const value = build(create, getScope, {
            type: 'get',
            nodes: [nodes[0]],
          });
          if (!key || !value) return null;
          return (staticSet as any)(block, value, key);
        }
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
    return getScope && { type: 'block', value: getScope() };
  }

  const args = nodes.map((n) => build(create, getScope, n));
  if (!args.every((x) => x)) return null;
  return buildValue(create, type, info, args);
};

export default build;
