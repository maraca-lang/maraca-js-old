import assign from './assign';
import Block from './block';
import { combineConfig, combineRun } from './combine';
import func from './func';
import maps from './maps';
import operations from './operations';
import {
  createStaticBlock,
  mergeStatic,
  staticAssign,
  staticCombine,
  staticMerge,
} from './static';
import { pushable, streamMap } from './util';

const mergeScope = (create, { scope, current }, newLayer = true) => ({
  type: 'any',
  static: staticMerge(scope.static, current.static),
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

  if (type === 'nil' || (type === 'value' && !info.value) || type === 'error') {
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
      current: createStaticBlock(),
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
        current: createStaticBlock(),
      };
      const compiled = block.nodes.map((n) => build(create, ctx, n));
      const orBlock = value.info.value === '1';
      return mergeStatic(create, compiled, false, (args, get) => {
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
    return args.reduce(
      (a1, a2, i) =>
        staticCombine(a1, a2) ||
        mergeStatic(
          create,
          [a1, a2],
          true,
          combineConfig(info.dot, info.space && info.space[i - 1]),
          combineRun,
        ),
    );
  }

  if (type === 'map') {
    const { map, deepArgs = [] } =
      typeof maps[info.func] === 'function'
        ? { map: maps[info.func] }
        : maps[info.func];
    return mergeStatic(
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
      const allArgs = [context.current, ...assignArgs];
      const stat = staticAssign(allArgs, info.append);
      context.current = mergeStatic(
        create,
        allArgs,
        true,
        assign(true, false, info.append),
      );
      context.current.static = stat;
    }
    return { type: 'constant', value: { type: 'value', value: '' } };
  }

  if (type === 'func') {
    if (args.every((a) => !a) && !info.map) {
      const value = build(create, context, info.body);
      context.current = mergeStatic(
        create,
        [context.current, value],
        false,
        ([c, v], get) => ({
          type: 'block',
          value: get(c).value.setFunc(get(v)),
        }),
      );
      return { type: 'constant', value: { type: 'value', value: '' } };
    }
    const funcArgs = func(create, context, info, args);
    const current = context.current.value;
    context.current = {
      type: 'any',
      static: context.current.static,
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
