import assign from './assign';
import combine from './combine';
import core from './core';
import { fromJs, fromJsFunc, fromValue, toJs, toValue } from './data';
import listUtils from './list';
import parse from './parse';

const snapshot = (create, { set, ...value }, index?) => {
  const result =
    value.type !== 'list'
      ? value
      : listUtils.fromPairs(
          listUtils.toPairs(value).map(({ key, value }, i) => ({
            key,
            value: snapshot(create, value, [...(index || [0]), i]),
          })),
        );
  return index ? create(core.settable(result), null, index) : result;
};

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

const getStreamBuild = (type, info) => (config, create, context, nodes) => {
  if (type === 'func') {
    const scope = context.scope[0];
    const funcMap = (
      funcScope = scope,
      funcCurrent = listUtils.empty(),
      key?,
    ) => (subCreate, value) => {
      const values = [key, value];
      const subContext = {
        scope: [funcScope],
        current: [funcCurrent],
        base: 0,
      };
      nodes.forEach((key, i) => {
        if (key) {
          subContext.scope[0] = create(
            assign([subContext.scope[0], values[i], key], true, false),
          );
        }
      });
      const result = build(config, subCreate, subContext, info.body);
      return [result, subContext.scope[0], subContext.current[0]];
    };
    const func = funcMap();
    context.current[0] = create(
      streamMap(([current]) =>
        listUtils.setFunc(
          current || listUtils.empty(),
          info.map ? funcMap : func,
          info.map,
          !(nodes[1].type === 'constant' && nodes[1].value.type === 'nil'),
        ),
      )([context.current[0]]),
    );
    return { type: 'nil' };
  }
  if (type === 'assign') {
    [context.scope, context.current].forEach(l => {
      l[0] = create(assign([l[0], ...nodes], true, false));
    });
    return { type: 'nil' };
  }
  if (type === 'push') {
    return create(({ get }) => {
      let source = get(nodes[0]);
      return {
        initial: { type: 'nil' },
        update: () => {
          const dest = get(nodes[1]);
          const newSource = get(nodes[0]);
          if (dest.set && source !== newSource) {
            dest.set(snapshot(create, get(nodes[0], true)));
          }
          source = newSource;
        },
      };
    });
  }
  if (type === 'interpret') {
    const func = config['@'] && config['@'][info.level - 1];
    if (!func) return { type: 'nil' };
    return create(fromJsFunc(nodes[0], func, true));
  }
  if (type === 'eval') {
    return create(
      streamMap(([code], create) => {
        const subContext = {
          scope: [nodes[1]],
          current: [listUtils.empty()],
          base: 0,
        };
        let parsed = { type: 'nil' };
        try {
          parsed = parse(code.type === 'value' ? code.value : '');
        } catch (e) {
          console.log(e.message);
        }
        return build(config, create, subContext, parsed);
      })([nodes[0]]),
    );
  }
  if (type === 'trigger') {
    return create(({ get, output }) => {
      let values = nodes.map(a => get(a));
      return {
        initial: values[1],
        update: () => {
          const newValues = nodes.map(a => get(a));
          if (values[0] !== newValues[0]) output({ ...newValues[1] });
          values = newValues;
        },
      };
    });
  }
  if (type === 'library') {
    return create(({ get, output, create }) => {
      const run = () => {
        const resolved = get(nodes[0]);
        const v = resolved.type !== 'list' && toJs(resolved);
        if (typeof v === 'number' && Math.floor(v) === v) {
          return listUtils.fromArray(
            Array.from({ length: v }).map((_, i) => fromJs(i + 1)),
          );
        }
        if (typeof v === 'string') {
          const func = config['#'] && config['#'][v];
          if (!func) return { type: 'nil' };
          if (typeof func !== 'function') {
            return create(() => ({ initial: toValue(func) }));
          }
          return create(({ output, get }) => {
            let first = true;
            let initial = { type: 'nil' };
            const emit = ({ set, ...data }) => {
              const value = {
                ...toValue(data),
                set: set && (v => set(fromValue(get(v, true)))),
              };
              if (first) initial = value;
              else output(value);
            };
            const stop = func(emit);
            first = false;
            return { initial, stop };
          });
        }
        const list = get(nodes[0], true);
        return fromJs(
          listUtils.toPairs(list).filter(d => d.value.type !== 'nil').length,
        );
      };
      return { initial: run(), update: () => output(run()) };
    });
  }
  if (type === 'combine') {
    return nodes.reduce((a1, a2, i) => {
      const argPair = [a1, a2];
      // if (
      //   (i === 1 && nodes[0].type === 'context') !==
      //   (nodes[i].type === 'context')
      // ) {
      //   const v = create(core.settable({ type: 'nil' }));
      //   const k = argPair[nodes[i].type === 'context' ? 0 : 1];
      //   const scopes = [...context.scope];
      //   [context.scope, context.current].forEach(l => {
      //     for (let j = 0; j <= context.base; j++) {
      //       l[j] = create(
      //         streamMap(([list, key, scope]) => {
      //           if (listUtils.getFunc(list)) return list;
      //           const res = listUtils.cloneValues(list);
      //           if (
      //             key.type !== 'list' &&
      //             !toIndex(key.value) &&
      //             !listUtils.has(scope, key)
      //           ) {
      //             return listUtils.set(res, key, v);
      //           }
      //           return res;
      //         })([l[j], k, scopes[j]]),
      //       );
      //     }
      //   });
      //   argPair[nodes[i].type === 'context' ? 1 : 0] = context.scope[0];
      // }
      return combine(
        create,
        argPair,
        info.dot,
        info.space && info.space[i - 1],
      )[0];
    });
  }
  if (type === 'identity') {
    return build(config, create, context, {
      type: 'list',
      nodes: [
        {
          type: 'func',
          nodes: [
            null,
            { type: 'value', info: { value: 'v' } },
            {
              type: 'combine',
              nodes: [
                { type: 'value', info: { value: 'v' } },
                { type: 'context' },
              ],
              info: { space: [false] },
            },
          ],
        },
      ],
      info: { bracket: '[' },
    });
  }
  if (type === 'context') {
    return context.scope[0];
  }
};

const getBuilder = (
  { type, nodes = [] as any[], info = {} as any } = {} as any,
) => {
  if (!type || type === 'nil' || type === 'comment') {
    return { type: 'constant', value: { type: 'nil' } };
  }
  if (type === 'value') {
    return { type: 'constant', value: { type: 'value', value: info.value } };
  }
  if (type === 'list') {
    //   if (!['[', '<'].includes(info.bracket)) {
    //     return build(config, create, context, {
    //       type: 'combine',
    //       info: { dot: true },
    //       nodes: [
    //         {
    //           type: 'value',
    //           info: {
    //             value: `${
    //               info.bracket === '('
    //                 ? nodes.filter(n => n.type !== 'func').length
    //                 : 1
    //             }`,
    //           },
    //         },
    //         { type: 'list', info: { bracket: '[', semi: true }, nodes },
    //       ],
    //     });
    //   }
    return {
      type: 'list',
      args: nodes.map(n => getBuilder({ type: 'assign', nodes: [n] })),
      start: (create, context) => {
        context.current.unshift(listUtils.empty());
        context.scope.unshift(
          create(
            streamMap(([value]) => listUtils.clearIndices(value))([
              context.scope[0],
            ]),
          ),
        );
      },
      end: (_, context) => {
        context.scope.shift();
        return context.current.shift();
      },
    };
  }
  const args = nodes.map(n => getBuilder(n));
  if (type === 'core') {
    const { map, deepArgs = [] } =
      typeof core[info.func] === 'function'
        ? { map: core[info.func] }
        : core[info.func];
    args.forEach((_, i) => {
      deepArgs[i] = deepArgs[i] || false;
    });
    if (args.every(a => a.type === 'constant')) {
      return { type: 'constant', value: map(args.map(a => a.value)) };
    }
    // if (args.every(a => a.type === 'constant' || a.type === 'map')) {
    //   return {
    //     type: 'map',
    //     args: args.reduce((res, a) => [...res, ...a.args], []),
    //     deepArgs: args.reduce((res, a) => [...res, ...a.deepArgs], []),
    //     map: ([...allArgs]) =>
    //       map(args.map(a => a.map(allArgs.splice(0, a.args.length)))),
    //   };
    // }
    return { type: 'map', args, deepArgs, map };
  }
  return { type: 'stream', args, build: getStreamBuild(type, info) };
};

const runBuilder = (builder, config, create, context) => {
  if (builder.type === 'constant') {
    return builder.value;
  }
  if (builder.type === 'list') {
    builder.start(create, context);
    builder.args.map(a => runBuilder(a, config, create, context));
    return builder.end(create, context);
  }
  const args = builder.args.map(a => runBuilder(a, config, create, context));
  if (builder.type === 'map') {
    return create(streamMap(builder.map)(args, builder.deepArgs));
  }
  if (builder.type === 'stream') {
    return builder.build(config, create, context, args);
  }
};

const build = (config, create, context, node) => {
  const builder = getBuilder(node);
  return runBuilder(builder, config, create, context);
};

export default build;
