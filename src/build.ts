import assign from './assign';
import Block from './block';
import { combineConfig, combineRun } from './combine';
import func from './func';
import maps from './maps';
import operations from './operations';
import { pushable, streamMap } from './util';

const mergeStatic = (create, args, ...maps) => {
  const map = maps.pop();
  const configMap = maps.pop();
  if (
    args.every(
      (a) =>
        a.type === 'value' ||
        (a.type === 'block' && !a.value.hasStreams()) ||
        a.type === 'map',
    )
  ) {
    const mapArgs = args.filter((a) => a.type === 'map').map((a) => a.arg);
    if (mapArgs.length === 0) {
      return map(configMap ? configMap(args, (x) => x) : args, (x) => x);
    }
    if (mapArgs.every((a) => a === mapArgs[0])) {
      return {
        type: 'map',
        arg: mapArgs[0],
        map: (x, get) => {
          const mapped = args.map((a) =>
            a.type === 'map' ? a.map(x, get) : a,
          );
          return map(configMap ? configMap(mapped, get) : mapped, get);
        },
      };
    }
  }
  return create((set, get, create) => {
    let result;
    let prev = [];
    return () => {
      const next = configMap ? configMap(args, get) : args;
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
  });
};

const mergeScope = (create, { scope, current }, newLayer = true) =>
  create(
    streamMap((get) => {
      const [s, c] = [get(scope), get(current)];
      if (c.type === 'value') return newLayer ? s : c;
      return {
        type: 'block',
        value: Block.fromPairs([
          ...s.value.toPairs(),
          ...(newLayer ? c.value.clearIndices() : c.value).toPairs(),
        ]),
      };
    }),
  );

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
                    (n) => !['func', 'assign', 'push', 'nil'].includes(n.type),
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
    return build(create, context, {
      type: 'combine',
      nodes: [{ type: 'context' }, nodes[0]],
    });
  }

  if (type === 'nil' || (type === 'value' && !info.value) || type === 'error') {
    return { type: 'value', value: '' };
  }
  if (type === 'value') {
    return { type: 'value', value: info.value };
  }
  if (type === 'context') {
    return mergeScope(create, context, false);
  }

  if (type === 'block') {
    const ctx = {
      scope: mergeScope(create, context),
      current: { type: 'block', value: new Block() },
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

  if (type === 'join') {
    return args.reduce((a1, a2, i) =>
      mergeStatic(create, [a1, a2], (args, get) =>
        maps[''](
          args.map((a) => get(a)),
          info.space[i - 1],
        ),
      ),
    );
  }

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
        current: { type: 'block', value: new Block() },
      };
      const compiled = block.nodes.map((n) => build(create, ctx, n));
      const orBlock = value.info.value === '1';
      return mergeStatic(create, compiled, (args, get) => {
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
    return args.reduce((a1, a2) =>
      mergeStatic(create, [a1, a2], combineConfig, combineRun),
    );
  }

  if (type === 'map') {
    const { map, deepArgs = [] } =
      typeof maps[info.func] === 'function'
        ? { map: maps[info.func] }
        : maps[info.func];
    return mergeStatic(create, args, (args, get) =>
      map(args.map((a, i) => get(a, deepArgs[i]))),
    );
  }

  if (type === 'assign') {
    if (!(info.append && args[0].type === 'value' && !args[0].value)) {
      const assignArgs = [context.current, ...[...args].filter((x) => x)];
      if (info.pushable) assignArgs[1] = create(pushable(assignArgs[1]));
      context.current = mergeStatic(
        create,
        assignArgs,
        assign(true, false, info.append),
      );
    }
    return { type: 'value', value: '' };
  }

  if (type === 'func') {
    if (args.every((a) => !a) && !info.map) {
      const value = build(create, context, info.value);
      context.current = mergeStatic(
        create,
        [context.current, value],
        ([c, v], get) => ({
          type: 'block',
          value: get(c).value.setFunc(get(v)),
        }),
      );
      return { type: 'value', value: '' };
    }
    const funcArgs = func(create, context, info, args);
    const prevCurrent = context.current;
    context.current = create(
      streamMap((get) => ({
        type: 'block',
        value: get(prevCurrent).value.setFunc(...funcArgs),
      })),
    );
    return { type: 'value', value: '' };
  }

  return operations(type, create, args);
};

export default build;
