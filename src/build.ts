import assign from './assign';
import combine from './combine';
import { fromJs, toIndex } from './data';
import maps from './maps';
import { combineValues } from './combine';
import listUtils from './list';
import streamBuild from './streams';

export const streamMap = map => (args, deeps = [] as boolean[]) => ({
  get,
  output,
  create,
}) => {
  const run = () => {
    create();
    return map(args.map((a, i) => get(a, deeps[i] || false)), create);
  };
  return { initial: run(), update: () => output(run()) };
};

export const settable = arg => ({ get, output }) => {
  const set = v => output({ ...v, set, wasSet: true });
  return {
    initial: { set, ...get(arg) },
    update: () => output({ set, ...get(arg) }),
  };
};

const mergeMaps = (create, args, deep, map) => {
  if (args.every(a => a.type === 'constant')) {
    return { type: 'constant', value: map(args.map(a => a.value)) };
  }
  const allArgs = args
    .filter(a => a.type !== 'constant')
    .map(a => (a.type === 'map' ? a.arg : a));
  if (allArgs.every(a => a === allArgs[0])) {
    const combinedMap = x =>
      map(
        args.map(a => {
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
};

const compile = ({ type, info = {} as any, nodes = [] as any[] }, evalArgs) => {
  if (type === 'list' && !['[', '<'].includes(info.bracket)) {
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
                  ? nodes.filter(n => n.type !== 'func').length
                  : 1
              }`,
            },
          },
          { type: 'list', info: { bracket: '[', semi: true }, nodes },
        ],
      },
      evalArgs,
    );
  }

  const [config, create, context] = evalArgs;

  if (
    type === 'nil' ||
    type === 'comment' ||
    (type === 'value' && !info.value)
  ) {
    return { type: 'constant', value: { type: 'nil' } };
  }
  if (type === 'value') {
    return { type: 'constant', value: { type: 'value', value: info.value } };
  }
  if (type === 'context') {
    return context.scope[0];
  }

  if (type === 'list') {
    const ctx = info.semi
      ? { scope: [...context.scope], current: [...context.current] }
      : { scope: [], current: [] };
    ctx.current.unshift({ type: 'constant', value: listUtils.empty() });
    ctx.scope.unshift({
      type: 'any',
      items: { ...context.scope[0].items },
      value: create(
        streamMap(([value]) => listUtils.clearIndices(value))([
          context.scope[0].value,
        ]),
      ),
    });
    nodes.forEach(n => {
      compile({ type: 'assign', nodes: [n], info: { append: true } }, [
        config,
        create,
        ctx,
      ]);
    });
    return ctx.current.shift();
  }

  const args = nodes.map(n => n && compile(n, evalArgs));

  if (type === 'combine') {
    return args.reduce((a1, a2, i) => {
      const space = info.space && info.space[i - 1];
      if (
        [a1, a2].some(a => a.items) &&
        [a1, a2].some(a => a.type === 'constant' && a.value.type !== 'list')
      ) {
        const [list, key] = a1.items ? [a1, a2] : [a2, a1];
        if (list.items[key.value.value || '']) {
          return list.items[key.value.value || ''];
        }
      }
      if (
        (i === 1 && nodes[0].type === 'context') !==
        (nodes[i].type === 'context')
      ) {
        const argPair = [a1, a2];
        const v = create(settable({ type: 'nil' }));
        const k = argPair[nodes[i].type === 'context' ? 0 : 1];
        const prevScopes = [...context.scope];
        [context.scope, context.current].forEach(l => {
          for (
            let j = context.current ? context.current.length - 1 : 0;
            j < l.length;
            j++
          ) {
            l[j] = {
              type: 'any',
              value: create(
                streamMap(([list, key, scope]) => {
                  if (listUtils.getFunc(list)) return list;
                  const res = listUtils.cloneValues(list);
                  if (
                    key.type !== 'list' &&
                    !toIndex(key.value) &&
                    !listUtils.has(scope, key)
                  ) {
                    return listUtils.set(res, key, v);
                  }
                  return res;
                })([l[j], k, prevScopes[j]].map(a => a.value)),
              ),
            };
          }
        });
        argPair[nodes[i].type === 'context' ? 1 : 0] = context.scope[0];
      }
      if ([a1, a2].every(a => !a.maybeFunc)) {
        const merged = mergeMaps(create, [a1, a2], true, ([v1, v2]) =>
          combineValues(v1, v2, info.dot, space),
        );
        if (merged) return merged;
      }
      return {
        type: 'any',
        value: combine(create, [a1.value, a2.value], info.dot, space),
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
      args.some(a => a.type === 'map' && a.deep) ||
        args.some((a, i) => a.type === 'any' && deepArgs[i]),
      vals => map(vals),
    );
    if (merged) return merged;
    return {
      type: 'any',
      value: create(streamMap(map)(args.map(a => a.value), deepArgs)),
    };
  }

  if (type === 'assign') {
    [context.scope, context.current].forEach(l => {
      if (
        !(
          info.append &&
          args[0].type === 'constant' &&
          args[0].value.type === 'nil'
        )
      ) {
        const prevItems = l[0].items || {};

        const assignArgs = [l[0], ...args].filter(x => x);
        if (!info.append && args[1] && context.scope.length === 1) {
          assignArgs[1] = {
            type: 'any',
            value: create(settable(assignArgs[1].value)),
          };
        }
        const merged = mergeMaps(create, assignArgs, true, ([l, v, k]) => {
          if (!k && info.append) {
            if (v.type === 'nil') return l;
            return listUtils.append(l, v);
          }
          if ((!k || k.type === 'list') && v.type === 'list') {
            return listUtils.destructure(l, k, v);
          }
          return listUtils.set(l, k || { type: 'nil' }, v);
        });
        if (merged) {
          l[0] = merged;
        } else {
          l[0] = {
            type: 'any',
            value: create(
              assign(assignArgs.map(a => a.value), true, false, info.append),
            ),
          };
        }

        if (
          !args[1] ||
          (args[1].type === 'constant' && args[1].value.type !== 'list')
        ) {
          if (!info.append) {
            prevItems[(args[1] && args[1].value.value) || ''] = assignArgs[1];
          }
          l[0].items = prevItems;
        } else {
          delete l[0].items;
        }
      }
    });
    return { type: 'constant', value: { type: 'nil' } };
  }

  if (type === 'func') {
    if (
      args
        .filter(a => a)
        .every(a => a.type === 'constant' && a.value.type !== 'list')
    ) {
      const argTrace = { type: 'any', value: { type: 'nil' } };
      const currentTrace = { type: 'constant', value: listUtils.empty() };
      const ctx = {
        scope: [
          {
            type: 'any',
            items: args.reduce(
              (res, a, i) =>
                a
                  ? {
                      ...res,
                      [a.value.value || '']: {
                        type: 'map',
                        arg: argTrace,
                        map: x => listUtils.get(x, fromJs(i + 1)),
                      },
                    }
                  : res,
              {},
            ),
            value: { type: 'nil ' },
          },
        ],
        current: [currentTrace],
      };
      const compiledBody = compile(info.body, [config, create, ctx]);
      if (
        compiledBody.type === 'map' &&
        compiledBody.arg === argTrace &&
        ctx.current[0] === currentTrace
      ) {
        context.current[0] = {
          type: 'any',
          items: { ...context.current[0].items },
          maybeFunc: true,
          value: create(
            streamMap(([current]) =>
              listUtils.setFunc(
                current || listUtils.empty(),
                info.map
                  ? (create, list) => [
                      create(
                        streamMap(([y]) =>
                          listUtils.fromPairs(
                            listUtils
                              .toPairs(y)
                              .filter(d => d.value.type !== 'nil')
                              .map(({ key, value }) => ({
                                key,
                                value: compiledBody.map(
                                  listUtils.fromArray([key, value]),
                                ),
                              }))
                              .filter(d => d.value.type !== 'nil'),
                          ),
                        )([list]),
                      ),
                    ]
                  : (create, value) => [
                      create(
                        streamMap(([y]) =>
                          compiledBody.map(
                            listUtils.fromArray([{ type: 'nil' }, y]),
                          ),
                        )([value]),
                      ),
                    ],
                info.map,
                !!args[1],
                true,
              ),
            )([context.current[0].value]),
          ),
        };
        return { type: 'constant', value: { type: 'nil' } };
      }
    }

    const argValues = args.map(a => a && a.value);
    const scope = context.scope[0].value;
    const funcMap = (
      funcScope = scope,
      funcCurrent = listUtils.empty(),
      key = null,
    ) => (subCreate, value) => {
      const values = [key, value];
      const subContext = {
        scope: [{ type: 'any', value: funcScope }],
        current: [{ type: 'any', value: funcCurrent }],
      };
      argValues.forEach((key, i) => {
        if (key) {
          subContext.scope[0] = {
            type: 'any',
            value: create(
              assign(
                [subContext.scope[0].value, values[i], key],
                true,
                false,
                false,
              ),
            ),
          };
        }
      });
      const result = build(config, subCreate, subContext, info.body);
      return [result, subContext.scope[0].value, subContext.current[0].value];
    };
    const func = funcMap();
    context.current[0] = {
      type: 'any',
      items: { ...context.current[0].items },
      maybeFunc: true,
      value: create(
        streamMap(([current]) =>
          listUtils.setFunc(
            current || listUtils.empty(),
            info.map ? funcMap : func,
            info.map,
            !!args[1],
          ),
        )([context.current[0].value]),
      ),
    };
    return { type: 'constant', value: { type: 'nil' } };
  }

  return {
    type: 'any',
    args,
    maybeFunc: true,
    value: streamBuild(type, info, config, create, args.map(a => a.value)),
  };
};

const build = (config, create, context, node) =>
  compile(node, [config, create, context]).value;

export default build;
