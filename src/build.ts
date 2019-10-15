import assign from './assign';
import combine from './combine';
import core from './core';
import { joinValues } from './combine';
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

const compile = (
  { type, nodes = [] as any[], info = {} as any } = {} as any,
  evalArgs,
) => {
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
  if (type === 'identity') {
    return compile(
      {
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
      },
      evalArgs,
    );
  }

  const [config, create, context] = evalArgs;

  if (!type || type === 'nil' || type === 'comment') {
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
    ctx.current.unshift({ type: 'list', static: {}, value: listUtils.empty() });
    ctx.scope.unshift({
      type: 'list',
      static: {},
      value: create(
        streamMap(([value]) => listUtils.clearIndices(value))([
          context.scope[0],
        ]),
      ),
    });
    nodes.forEach(n => {
      compile({ type: 'assign', nodes: [n] }, [config, create, ctx]);
    });
    return ctx.current.shift();
  }

  const args = nodes.map(n => compile(n, evalArgs));
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
        [a1, a2].some(a => a.type === 'list') &&
        [a1, a2].some(a => a.type === 'constant' && a.value.type !== 'list')
      ) {
        const [list, key] = a1.type === 'list' ? [a1, a2] : [a2, a1];
        if (list.static[key.value.value || '']) {
          return list.static[key.value.value || ''];
        }
      }
      return { type: 'combine', args: [a1, a2], dot: info.dot, space };
    });
  }
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
    return { type: 'map', args, deepArgs, map };
  }

  args.forEach(a => evaluate(a, config, create, context));
  if (type === 'assign') {
    [context.scope, context.current].forEach(l => {
      if (args[1]) {
        if (args[1].type === 'constant' && args[1].value.type !== 'list') {
          l[0].static[args[1].value.value || ''] = args[0];
        } else {
          Object.keys(l[0].static).forEach(k => {
            delete l[0].static[k];
          });
        }
      }
      if (
        args[1] ||
        !(args[0].type === 'constant' && args[0].value.type === 'nil')
      ) {
        l[0].value = create(
          assign([l[0].value, ...args.map(a => a.value)], true, false),
        );
      }
    });
    return { type: 'constant', value: { type: 'nil' } };
  }
  return {
    type: 'stream',
    args,
    value: streamBuild(
      type,
      info,
      config,
      create,
      context,
      args.map(a => a.value),
    ),
  };
};

const evaluateInner = (compiled, config, create, context) => {
  const args = compiled.args.map(a => {
    evaluate(a, config, create, context);
    return a.value;
  });
  if (compiled.type === 'map') {
    return create(streamMap(compiled.map)(args, compiled.deepArgs));
  }
  if (compiled.type === 'combine') {
    return combine(create, args, compiled.dot, compiled.space)[0];
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
