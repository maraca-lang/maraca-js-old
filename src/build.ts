import assign from './assign';
import combine from './combine';
import maps from './maps';
import { joinValues } from './combine';
import listUtils from './list';
import shorthands from './shorthands';
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

const compile = ({ type, info = {} as any, nodes = [] as any[] }, evalArgs) => {
  const shorthand = shorthands(type, info, nodes);
  if (shorthand) return compile(shorthand, evalArgs);

  const [config, create, context] = evalArgs;

  if (type === 'nil' || type === 'comment') {
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
      compile({ type: 'assign', nodes: [n] }, [config, create, ctx]);
    });
    return ctx.current.shift();
  }

  const args = nodes.map(n => n && compile(n, evalArgs));
  if (type === 'combine') {
    return args.reduce((a1, a2, i) => {
      const space = info.space && info.space[i - 1];
      if (
        [a1, a2].every(a => a.type === 'constant' && a.value.type !== 'list')
      ) {
        return {
          type: 'constant',
          value: joinValues(a1.value, a2.value, space),
        };
      }
      if (
        [a1, a2].some(a => a.items) &&
        [a1, a2].some(a => a.type === 'constant' && a.value.type !== 'list')
      ) {
        const [list, key] = a1.items ? [a1, a2] : [a2, a1];
        if (list.items[key.value.value || '']) {
          return list.items[key.value.value || ''];
        }
      }
      [a1, a2].forEach(a => evaluate(a, config, create, context));
      return {
        type: 'any',
        value: combine(create, [a1.value, a2.value], info.dot, space)[0],
      };
    });
  }
  if (type === 'map') {
    const { map, deepArgs = [] } =
      typeof maps[info.func] === 'function'
        ? { map: maps[info.func] }
        : maps[info.func];
    if (args.every(a => a.type === 'constant')) {
      return { type: 'constant', value: map(args.map(a => a.value)) };
    }
    const allArgs = args
      .filter(a => a.type !== 'constant')
      .map(a => (a.type === 'map' ? a.arg : a));
    if (allArgs.every(a => a === allArgs[0])) {
      return {
        type: 'map',
        arg: allArgs[0],
        deep: allArgs.some(a => a.type === 'map' && a.deep),
        map: x =>
          map(
            args.map(a => {
              if (a.type === 'constant') return a.value;
              if (a.type === 'map') return a.map(x);
              return x;
            }),
          ),
      };
    }
    args.forEach(a => evaluate(a, config, create, context));
    return {
      type: 'any',
      value: create(streamMap(map)(args.map(a => a.value), deepArgs)),
    };
  }
  if (type === 'func') {
    if (
      args
        .filter(a => a)
        .every(a => a.type === 'constant' && a.value.type !== 'list')
    ) {
      const argTrace = { type: 'any', value: { type: 'nil ' } };
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
                        map: x =>
                          listUtils.get(x, {
                            type: 'value',
                            value: `${i + 1}`,
                          }),
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
          value: create(
            streamMap(([current]) =>
              listUtils.setFunc(
                current || listUtils.empty(),
                info.map
                  ? (create, list) => [
                      create(
                        streamMap(([y]) =>
                          listUtils.fromArray(
                            listUtils
                              .toPairs(y)
                              .filter(d => d.value.type !== 'nil')
                              .map(({ key, value }) =>
                                compiledBody.map(
                                  listUtils.fromArray([key, value]),
                                ),
                              )
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

    args.forEach(a => a && evaluate(a, config, create, context));
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
              assign([subContext.scope[0].value, values[i], key], true, false),
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

  args.forEach(a => evaluate(a, config, create, context));
  if (type === 'assign') {
    [context.scope, context.current].forEach(l => {
      const prevItems = l[0].items || {};
      if (
        args[1] ||
        !(args[0].type === 'constant' && args[0].value.type === 'nil')
      ) {
        l[0] = {
          type: 'any',
          value: create(
            assign([l[0].value, ...args.map(a => a.value)], true, false),
          ),
        };
      }
      if (args[1]) {
        if (args[1].type === 'constant' && args[1].value.type !== 'list') {
          prevItems[args[1].value.value || ''] = args[0];
          l[0].items = prevItems;
        } else {
          delete l[0].items;
        }
      }
    });
    return { type: 'constant', value: { type: 'nil' } };
  }
  return {
    type: 'any',
    args,
    value: streamBuild(type, info, config, create, args.map(a => a.value)),
  };
};

const evaluateInner = (compiled, config, create, context) => {
  if (compiled.type === 'map') {
    evaluate(compiled.arg, config, create, context);
    return create(
      streamMap(([x]) => compiled.map(x))(
        [compiled.arg.value],
        [compiled.deep],
      ),
    );
  }
};
const evaluate = (compiled, config, create, context) => {
  if (!compiled.value) {
    compiled.value = evaluateInner(compiled, config, create, context);
  }
};

const build = (config, create, context, node) => {
  const compiled = compile(node, [config, create, context]);
  evaluate(compiled, config, create, context);
  return compiled.value;
};

export default build;

// if (type === 'combine') {
//   return nodes.reduce((a1, a2, i) => {
//     const argPair = [a1, a2];
//     // if (
//     //   (i === 1 && nodes[0].type === 'context') !==
//     //   (nodes[i].type === 'context')
//     // ) {
//     //   const v = create(core.settable({ type: 'nil' }));
//     //   const k = argPair[nodes[i].type === 'context' ? 0 : 1];
//     //   const scopes = [...context.scope];
//     //   [context.scope, context.current].forEach(l => {
//     //     for (let j = 0; j <= context.base; j++) {
//     //       l[j] = create(
//     //         streamMap(([list, key, scope]) => {
//     //           if (listUtils.getFunc(list)) return list;
//     //           const res = listUtils.cloneValues(list);
//     //           if (
//     //             key.type !== 'list' &&
//     //             !toIndex(key.value) &&
//     //             !listUtils.has(scope, key)
//     //           ) {
//     //             return listUtils.set(res, key, v);
//     //           }
//     //           return res;
//     //         })([l[j], k, scopes[j]]),
//     //       );
//     //     }
//     //   });
//     //   argPair[nodes[i].type === 'context' ? 1 : 0] = context.scope[0];
//     // }
//     return combine(
//       create,
//       argPair,
//       info.dot,
//       info.space && info.space[i - 1],
//     )[0];
//   });
// }
