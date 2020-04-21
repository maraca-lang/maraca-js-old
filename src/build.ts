import assign from './assign';
import combine from './combine';
import { fromJs } from './data';
import maps from './maps';
import { combineValues } from './combine';
import Block from './block';
import operations from './operations';

export const streamMap = (map) => (args, deeps = [] as boolean[]) => (
  set,
  get,
  create,
) => () =>
  set(
    map(
      args.map((a, i) => get(a, deeps[i] || false)),
      create,
    ),
  );

export const pushable = (arg) => (set, get) => {
  const push = (v) => set({ ...v, push });
  return () => set({ push, ...get(arg) });
};

const mergeMaps = (create, args, deep, map) => {
  if (args.every((a) => a.type !== 'any')) {
    if (args.every((a) => a.type === 'constant')) {
      return { type: 'constant', value: map(args.map((a) => a.value)) };
    }
    const allArgs = args
      .filter((a) => a.type !== 'constant')
      .map((a) => (a.type === 'map' ? a.arg : a));
    if (allArgs.every((a) => a === allArgs[0])) {
      const combinedMap = (x) =>
        map(
          args.map((a) => {
            if (a.type === 'constant') return a.value;
            if (a.type === 'map') return a.map(x);
            return x;
          }),
        );
      return {
        type: 'map',
        arg: allArgs[0],
        deep,
        map: combinedMap,
        value: create(
          streamMap(([x]) => combinedMap(x))([allArgs[0].value], [deep]),
        ),
      };
    }
  }
};

const buildContextLayer = (create, context) => ({
  scope: {
    type: 'any',
    items: context.current.items
      ? { ...context.scope.items, ...context.current.items }
      : {},
    value: create(
      streamMap(([scope, current]) => {
        if (current.type === 'value') return scope;
        return {
          type: 'block',
          value: Block.fromPairs([
            ...scope.value.toPairs(),
            ...current.value.clearIndices().toPairs(),
          ]),
        };
      })([context.scope.value, context.current.value]),
    ),
  },
  current: {
    type: 'constant',
    value: { type: 'block', value: new Block() },
  },
});

const getCompiledMap = (node, evalArgs, argTrace) => {
  const compiled = compile(node, evalArgs);
  if (compiled.type === 'constant') return () => compiled.value;
  if (compiled.type === 'map' && compiled.arg === argTrace) return compiled.map;
  return null;
};
const compileFuncBody = (body, evalArgs, isMap, argTrace) => {
  if (
    isMap &&
    body.type === 'assign' &&
    body.nodes[1] === null &&
    body.nodes[0].type === 'block' &&
    body.nodes[0].info.bracket === '[' &&
    body.nodes[0].nodes.length === 1
  ) {
    const value = getCompiledMap(body.nodes[0].nodes[0], evalArgs, argTrace);
    return value && { value, index: true };
  }
  if (isMap && body.type === 'assign' && body.nodes[0] && body.nodes[1]) {
    const maps = body.nodes.map((n) => getCompiledMap(n, evalArgs, argTrace));
    return maps.every((c) => c) && { value: maps[0], key: maps[1] };
  }
  const value = getCompiledMap(body, evalArgs, argTrace);
  return value && { value };
};

const compile = ({ type, info = {} as any, nodes = [] as any[] }, evalArgs) => {
  if (type === 'block' && !['[', '<'].includes(info.bracket)) {
    return compile(
      {
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
          { type: 'block', info: { bracket: '[', semi: true }, nodes },
        ],
      },
      evalArgs,
    );
  }

  const [create, context] = evalArgs;

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
    return {
      type: 'any',
      value: create(
        streamMap(([scope, current]) => {
          if (current.type === 'value') return current;
          return {
            type: 'block',
            value: Block.fromPairs([
              ...scope.value.toPairs(),
              ...current.value.toPairs(),
            ]),
          };
        })([context.scope.value, context.current.value]),
      ),
    };
  }

  if (type === 'block') {
    const ctx = buildContextLayer(create, context);
    nodes.forEach((n) => {
      compile({ type: 'assign', nodes: [n], info: { append: true } }, [
        create,
        ctx,
      ]);
    });
    return ctx.current;
  }

  const args = nodes.map((n) => n && compile(n, evalArgs));

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
      const ctx = buildContextLayer(create, context);
      const compiled = block.nodes.map((n) => compile(n, [create, ctx]));
      const orBlock = value.info.value === '1';
      return {
        type: 'any',
        value: create((set, get) => () => {
          let result = { type: 'value', value: '' };
          for (let i = 0; i < block.nodes.length; i++) {
            result = get(compiled[i].value);
            if (!orBlock === !result.value) break;
          }
          set(result);
        }),
      };
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
      const merged = mergeMaps(create, [a1, a2], true, ([v1, v2]) =>
        combineValues(v1, v2, info.dot, space),
      );
      if (merged) return merged;
      return {
        type: 'any',
        value: combine(
          create,
          [a1, a2].map((a) => a.value),
          info.dot,
          space,
        ),
      };
    });
  }

  if (type === 'map') {
    const { map, deepArgs = [] } =
      typeof maps[info.func] === 'function'
        ? { map: maps[info.func] }
        : maps[info.func];
    const merged = mergeMaps(
      create,
      args,
      args.some((a) => a.type === 'map' && a.deep) ||
        args.some((a, i) => a.type === 'data' && deepArgs[i]),
      (vals) => map(vals),
    );
    if (merged) return merged;
    return {
      type: 'any',
      value: create(
        streamMap(map)(
          args.map((a) => a.value),
          deepArgs,
        ),
      ),
    };
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
      const merged = mergeMaps(create, allArgs, true, ([l, v, k]) => {
        if (!k && info.append) {
          if (!v.value) return l;
          return { type: 'block', value: l.value.append(v) };
        }
        if ((!k || k.type === 'block') && v.type === 'block') {
          return { type: 'block', value: l.value.destructure(k, v) };
        }
        return {
          type: 'block',
          value: l.value.set(k || { type: 'value', value: '' }, v),
        };
      });
      context.current = merged || {
        type: 'any',
        value: create(
          assign(
            allArgs.map((a) => a.value),
            true,
            false,
            info.append,
          ),
        ),
      };
      if (
        !info.append &&
        (!allArgs[2] ||
          (allArgs[2].type === 'constant' && allArgs[2].value.type !== 'block'))
      ) {
        prevItems[(allArgs[2] && allArgs[2].value.value) || ''] = allArgs[1];
        context.current.items = prevItems;
      }
    }
    return { type: 'constant', value: { type: 'value', value: '' } };
  }

  if (type === 'func') {
    if (
      args
        .filter((a) => a)
        .every((a) => a.type === 'constant' && a.value.type !== 'block')
    ) {
      const argTrace = { type: 'data', value: { type: 'value', value: '' } };
      const currentTrace = {
        type: 'constant',
        value: { type: 'block', value: new Block() },
      };
      const ctx = {
        scope: {
          type: 'any',
          items: args.reduce(
            (res, a, i) =>
              a
                ? {
                    ...res,
                    [a.value.value || '']: {
                      type: 'map',
                      arg: argTrace,
                      map: (x) => x.value.get(fromJs(i + 1)),
                    },
                  }
                : res,
            {},
          ),
          value: { type: 'nil ' },
        },
        current: currentTrace,
      };
      const compiledBody = compileFuncBody(
        info.body,
        [create, ctx],
        info.map,
        argTrace,
      );
      if (compiledBody && ctx.current === currentTrace) {
        context.current = {
          type: 'any',
          items: { ...context.current.items },
          value: create(
            streamMap(([current]) => ({
              type: 'block',
              value: ((current && current.value) || new Block()).setFunc(
                info.map
                  ? (create, block) => [
                      create(
                        streamMap(([y]) => {
                          const mapped = y.value
                            .toPairs()
                            .filter((d) => d.value.value)
                            .map(({ key, value }) => ({
                              key: compiledBody.key
                                ? compiledBody.key({
                                    type: 'block',
                                    value: Block.fromArray([key, value]),
                                  })
                                : key,
                              value: compiledBody.value({
                                type: 'block',
                                value: Block.fromArray([key, value]),
                              }),
                            }))
                            .filter((d) => d.value.value);
                          return {
                            type: 'block',
                            value: Block.fromPairs(
                              compiledBody.index
                                ? mapped.map((d, i) => ({
                                    key: fromJs(i + 1),
                                    value: d.value,
                                  }))
                                : mapped,
                            ),
                          };
                        })([block], [true]),
                      ),
                    ]
                  : (create, value) => [
                      create(
                        streamMap(([y]) =>
                          compiledBody.value({
                            type: 'block',
                            value: Block.fromArray([
                              { type: 'value', value: '' },
                              y,
                            ]),
                          }),
                        )([value]),
                      ),
                    ],
                info.map,
                !!args[1],
                true,
              ),
            }))([context.current.value]),
          ),
        };
        return { type: 'constant', value: { type: 'value', value: '' } };
      }
    }

    const argValues = args.map((a) => a && a.value);
    const scope = context.scope.value;
    const funcMap = (
      funcScope = scope,
      funcCurrent = { type: 'block', value: new Block() },
      key = null,
    ) => (subCreate, value) => {
      const values = [key, value];
      const subContext = {
        scope: { type: 'any', value: funcScope },
        current: { type: 'any', value: funcCurrent },
      };
      argValues.forEach((key, i) => {
        if (key) {
          subContext.scope = {
            type: 'any',
            value: create(
              assign(
                [subContext.scope.value, values[i], key],
                true,
                false,
                false,
              ),
            ),
          };
        }
      });
      const result = build(subCreate, subContext, info.body);
      return [result, subContext.scope.value, subContext.current.value];
    };
    context.current = {
      type: 'any',
      items: { ...context.current.items },
      value: create(
        streamMap(([current]) => ({
          type: 'block',
          value: ((current && current.value) || new Block()).setFunc(
            info.map ? funcMap : funcMap(),
            info.map,
            !!args[1],
          ),
        }))([context.current.value]),
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

const build = (create, context, node) => compile(node, [create, context]).value;

export default build;
