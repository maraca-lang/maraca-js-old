import assign from './assign';
import Block from './block';
import { combineConfig, combineRun } from './combine';
import func from './func';
import maps from './maps';
import operations from './operations';
import { pushable, streamMap } from './util';

const id = (x) => x;
const mergeMaps = (create, args, deep, ...maps) => {
  const map = maps.pop();
  const configMap = maps.pop();
  if (args.every((a) => a.type !== 'any')) {
    if (args.every((a) => a.type === 'constant')) {
      const mapped = args.map((a) => a.value);
      return {
        type: 'constant',
        value: map(configMap ? configMap(mapped, id) : mapped, id),
      };
    }
    const allArgs = args
      .filter((a) => a.type !== 'constant')
      .map((a) => (a.type === 'map' ? a.arg : a));
    if (allArgs.every((a) => a === allArgs[0])) {
      const combinedMap = (x) => {
        const mapped = args.map((a) => {
          if (a.type === 'constant') return a.value;
          if (a.type === 'map') return a.map(x);
          return x;
        });
        return map(configMap ? configMap(mapped, id) : mapped, id);
      };
      return {
        type: 'map',
        arg: allArgs[0],
        deep,
        map: combinedMap,
        value: create(
          streamMap((get) => combinedMap(get(allArgs[0].value, deep))),
        ),
      };
    }
  }
  const mapped = args.map((a) => a.value);
  return {
    type: 'any',
    value: create((set, get, create) => {
      let result;
      let prev = [];
      return () => {
        const next = configMap ? configMap(mapped, get) : mapped;
        if (
          !configMap ||
          prev.length !== next.length ||
          prev.some((x, i) => x !== next[i])
        ) {
          if (result && result.type === 'stream') result.value.cancel();
          result = map(next, get, create);
          set(result);
          prev = next;
        }
      };
    }),
  };
};

const mergeScope = (create, { scope, current }, newLayer = true) => ({
  type: 'any',
  items: current.items ? { ...scope.items, ...current.items } : {},
  value: create(
    streamMap((get) => {
      const [s, c] = [get(scope.value), get(current.value)];
      if (c.type === 'value') return newLayer ? s : c;
      return {
        type: 'block',
        value: Block.fromPairs([
          ...s.value.toPairs(),
          ...(newLayer ? c.value.clearIndices() : c.value).toPairs(),
        ]),
      };
    }),
  ),
});

const build = (
  create,
  context,
  { type, info = {} as any, nodes = [] as any[] },
) => {
  if (type === 'block' && !['[', '<'].includes(info.bracket)) {
    return build(create, context, {
      type: 'combine',
      info: { dot: true },
      nodes: [
        {
          type: 'value',
          info: {
            value: `${
              info.bracket === '('
                ? nodes.filter((n) => n.type !== 'func').length
                : 1
            }`,
          },
        },
        { type: 'block', info: { bracket: '[' }, nodes },
      ],
    });
  }

  if (
    type === 'nil' ||
    type === 'comment' ||
    (type === 'value' && !info.value) ||
    type === 'error'
  ) {
    return { type: 'constant', value: { type: 'value', value: '' } };
  }
  if (type === 'value') {
    return { type: 'constant', value: { type: 'value', value: info.value } };
  }
  if (type === 'context') {
    return mergeScope(create, context, false);
  }

  if (type === 'block') {
    const ctx = {
      scope: mergeScope(create, context),
      current: {
        type: 'constant',
        items: {},
        value: { type: 'block', value: new Block() },
      },
    };
    nodes.forEach((n) => {
      build(create, ctx, {
        type: 'assign',
        nodes: [n],
        info: { append: true },
      });
    });
    return ctx.current;
  }

  const args = nodes.map((n) => n && build(create, context, n));

  if (
    type === 'combine' &&
    nodes.length === 2 &&
    ((nodes[0].type === 'block' && nodes[1].type === 'value') ||
      (nodes[1].type === 'block' && nodes[0].type === 'value'))
  ) {
    const [block, value] =
      nodes[0].type === 'block' ? nodes : [nodes[1], nodes[0]];
    if (
      block.nodes.every((n) => n.type !== 'func') &&
      (value.info.value === '1' || value.info.value === `${block.nodes.length}`)
    ) {
      const ctx = {
        scope: mergeScope(create, context),
        current: {
          type: 'constant',
          items: {},
          value: { type: 'block', value: new Block() },
        },
      };
      const compiled = block.nodes.map((n) => build(create, ctx, n));
      const orBlock = value.info.value === '1';
      return mergeMaps(create, compiled, false, (args, get) => {
        for (let i = 0; i < block.nodes.length; i++) {
          const result = get(args[i]);
          if (!orBlock === !result.value || i === block.nodes.length - 1) {
            return result;
          }
        }
      });
    }
  }

  if (type === 'combine') {
    return args.reduce((a1, a2, i) => {
      const space = info.space && info.space[i - 1];
      if (
        [a1, a2].some((a) => a.items) &&
        [a1, a2].some((a) => a.type === 'constant' && a.value.type !== 'block')
      ) {
        const [block, key] = a1.items ? [a1, a2] : [a2, a1];
        if (block.items[key.value.value || '']) {
          return block.items[key.value.value || ''];
        }
      }
      return mergeMaps(
        create,
        [a1, a2],
        true,
        combineConfig(info.dot, space),
        combineRun,
      );
    });
  }

  if (type === 'map') {
    const { map, deepArgs = [] } =
      typeof maps[info.func] === 'function'
        ? { map: maps[info.func] }
        : maps[info.func];
    return mergeMaps(
      create,
      args,
      args.some((a) => a.type === 'map' && a.deep) ||
        args.some((a, i) => a.type === 'data' && deepArgs[i]),
      (args, get) => map(args.map((a, i) => get(a, deepArgs[i]))),
    );
  }

  if (type === 'assign') {
    if (!(info.append && args[0].type === 'constant' && !args[0].value.value)) {
      const assignArgs = [...args].filter((x) => x);
      if (info.pushable) {
        assignArgs[0] = {
          type: 'any',
          value: create(pushable(assignArgs[0].value)),
        };
      }
      const prevItems = context.current.items || {};
      const allArgs = [context.current, ...assignArgs];
      context.current = mergeMaps(
        create,
        allArgs,
        true,
        assign(true, false, info.append),
      );
      if (!info.append || allArgs[1].type !== 'any') {
        if (
          !info.append &&
          (!allArgs[2] ||
            (allArgs[2].type === 'constant' &&
              allArgs[2].value.type !== 'block'))
        ) {
          prevItems[(allArgs[2] && allArgs[2].value.value) || ''] = allArgs[1];
        }
        context.current.items = prevItems;
      }
    }
    return { type: 'constant', value: { type: 'value', value: '' } };
  }

  if (type === 'func') {
    const funcArgs = func(create, context, info, args);
    const current = context.current.value;
    context.current = {
      type: 'any',
      items: { ...context.current.items },
      value: create(
        streamMap((get) => ({
          type: 'block',
          value: get(current).value.setFunc(...funcArgs),
        })),
      ),
    };
    return { type: 'constant', value: { type: 'value', value: '' } };
  }

  return {
    type: 'any',
    value: operations(
      type,
      create,
      args.map((a) => a.value),
    ),
  };
};

export default build;
