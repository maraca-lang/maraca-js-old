import Block from './block';
import { combineConfig, combineRun } from './combine';
import effects from './effects';
import maps from './maps';
import parse from './parse';
import mergeStatic from './static';
import { streamMap } from './util';

const mergeScopeBase = (scope, current, newLayer) => ({
  type: 'block',
  value: Block.fromPairs([
    ...scope.value.toPairs(),
    ...(newLayer ? current.value.clearIndices() : current.value).toPairs(),
  ]),
});
const mergeScope = (create, { scope, current }, newLayer) => {
  if (scope.type === 'block' && current.type === 'block') {
    return mergeScopeBase(scope, current, newLayer);
  }
  return create(
    streamMap((get) => mergeScopeBase(get(scope), get(current), newLayer)),
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

  if (type === 'get') {
    return build(create, context, {
      type: 'combine',
      nodes: [{ type: 'context' }, nodes[0]],
    });
  }

  if (type === 'block') {
    const ctx = {
      scope: mergeScope(create, context, true),
      current: { type: 'block', value: new Block() },
    };
    nodes.forEach((n) => {
      if (['func', 'set', 'push'].includes(n.type)) {
        ctx.current = effects(create, ctx, n);
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

  if (type === 'nil' || (type === 'value' && !info.value) || type === 'error') {
    return { type: 'value', value: '' };
  }
  if (type === 'value') {
    return { type: 'value', value: info.value };
  }
  if (type === 'context') {
    return mergeScope(create, context, false);
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

  if (type === 'eval') {
    return create(
      streamMap((get, create) => {
        const code = get(args[0]);
        const arg = get(args[1]);
        const subContext = {
          scope: { type: 'block', value: new Block() },
          current:
            arg.type === 'block' ? arg : { type: 'block', value: new Block() },
        };
        let parsed = { type: 'nil' };
        try {
          parsed = parse(code.type === 'value' ? code.value : '');
        } catch (e) {
          console.log(e.message);
        }
        return build(create, subContext, parsed);
      }),
    );
  }

  if (type === 'trigger') {
    return create((set, get) => {
      let trigger;
      return () => {
        const newTrigger = get(args[0], true);
        if (trigger !== newTrigger && newTrigger.value) {
          set({ ...get(args[1], true, true) });
        }
        trigger = newTrigger;
      };
    });
  }
};

export default build;
