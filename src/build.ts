import assign from './assign';
import combine from './combine';
import core, { streamMap } from './core';
import { fromJs, fromJsFunc, fromValue, toIndex, toJs, toValue } from './data';
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

const buildBase = (
  config,
  create,
  context,
  { type, nodes = [] as any[], info = {} as any },
) => {
  if (type === 'func') {
    const [keyNode, valueNode, outputNode] = nodes;
    const scope = context.scope[0];
    const keys = [keyNode, valueNode].map(
      n => n && build(config, create, context, n),
    );
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
      keys.forEach((key, i) => {
        if (key) {
          subContext.scope[0] = create(
            assign([subContext.scope[0], values[i], key], true, false),
          );
        }
      });
      const result = build(config, subCreate, subContext, outputNode);
      return [result, subContext.scope[0], subContext.current[0]];
    };
    const func = funcMap();
    context.current[0] = create(
      streamMap(([current]) =>
        listUtils.setFunc(
          current || listUtils.empty(),
          info.map ? funcMap : func,
          info.map,
          !!valueNode,
        ),
      )([context.current[0]]),
    );
    return { type: 'nil' };
  }
  if (type === 'assign') {
    const args = nodes.map(n => build(config, create, context, n));
    [context.scope, context.current].forEach(l => {
      l[0] = create(assign([l[0], ...args], true, false));
    });
    return { type: 'nil' };
  }
  if (type === 'push') {
    const args = nodes.map(n => build(config, create, context, n));
    return create(({ get }) => {
      let source = get(args[0]);
      return {
        initial: { type: 'nil' },
        update: () => {
          const dest = get(args[1]);
          const newSource = get(args[0]);
          if (dest.set && source !== newSource) {
            dest.set(snapshot(create, get(args[0], true)));
          }
          source = newSource;
        },
      };
    });
  }
  if (type === 'interpret') {
    const func = config['@'] && config['@'][info.level - 1];
    if (!func) return { type: 'nil' };
    const arg = build(config, create, context, nodes[0]);
    return create(fromJsFunc(arg, func, true));
  }
  if (type === 'core') {
    const args = nodes.map(n => build(config, create, context, n));
    if (info.func === '$') {
      return create(
        streamMap(([code], create) => {
          const subContext = {
            scope: [args[1]],
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
        })([args[0]]),
      );
    }
    return create(core[info.func](args));
  }
  if (type === 'library') {
    const arg = build(config, create, context, nodes[0]);
    return create(({ get, output, create }) => {
      const run = () => {
        const resolved = get(arg);
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
        const list = get(arg, true);
        return fromJs(
          listUtils.toPairs(list).filter(d => d.value.type !== 'nil').length,
        );
      };
      return { initial: run(), update: () => output(run()) };
    });
  }
  if (type === 'list') {
    if (!['[', '<'].includes(info.bracket)) {
      return build(config, create, context, {
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
      });
    }
    const prevBase = context.base;
    context.base = info.semi ? context.base + 1 : 0;
    context.current.unshift(
      create(({ output }) => {
        let currentValue = listUtils.empty();
        const set = (key, value) => {
          if (value === undefined) {
            const set = v => output({ ...v, set, wasSet: true });
            output({ ...key, set, wasSet: true });
          } else {
            currentValue = listUtils.set(currentValue, key, value);
            output({ set, ...currentValue });
          }
        };
        return { initial: { set, ...currentValue } };
      }),
    );
    context.scope.unshift(
      create(
        streamMap(([s, c]) =>
          listUtils.fromPairs([
            ...listUtils.toPairs(listUtils.clearIndices(s)),
            ...(c.type === 'list' ? listUtils.toPairs(c) : []),
          ]),
        )([context.scope[0], context.current[0]]),
      ),
    );
    nodes.forEach(n =>
      build(config, create, context, { type: 'assign', nodes: [n] }),
    );
    context.base = prevBase;
    context.scope.shift();
    return context.current.shift();
  }
  if (type === 'combine') {
    const args = nodes.map(n => build(config, create, context, n));
    return args.reduce((a1, a2, i) => {
      const argPair = [a1, a2];
      if (
        (i === 1 && nodes[0].type === 'context') !==
        (nodes[i].type === 'context')
      ) {
        const v = create(core.settable({ type: 'nil' }));
        const k = argPair[nodes[i].type === 'context' ? 0 : 1];
        const scopes = [...context.scope];
        [context.scope, context.current].forEach(l => {
          for (let j = 0; j <= context.base; j++) {
            l[j] = create(
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
              })([l[j], k, scopes[j]]),
            );
          }
        });
        argPair[nodes[i].type === 'context' ? 1 : 0] = context.scope[0];
      }
      return combine(
        create,
        argPair,
        info.dot,
        info.space && info.space[i - 1],
      )[0];
    });
  }
  if (type === 'value') {
    return { type: 'value', value: info.value };
  }
  if (type === 'nil') {
    return { type: 'nil' };
  }
  if (type === 'identity') {
    return buildBase(config, create, context, {
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
  if (type === 'comment') {
    return { type: 'nil' };
  }
};

const build = (config, create, context, node) =>
  create(core.settable(buildBase(config, create, context, node)));

export default build;
