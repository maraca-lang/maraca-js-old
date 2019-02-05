import assign from './assign';
import combine from './combine';
import core, { streamMap } from './core';
import { toData, toKey, toTypedValue } from './data';
import parse from './parse';

const isPure = ({ type, nodes = [] }) => {
  if (['assign', 'other'].includes(type)) return false;
  if (type === 'list') return true;
  return nodes.every(isPure);
};

const build = (
  config,
  create,
  context,
  { type, nodes = [] as any[], info = {} as any },
) => {
  if (type === 'other') {
    const [keyNode, valueNode, outputNode] = nodes;
    const scope = context.scope[0];
    const keys = [keyNode, valueNode].map(
      n => n && build(config, create, context, n),
    );
    const otherMap = (
      otherScope = scope,
      otherCurrent = { type: 'list', value: { indices: [], values: {} } },
      key?,
    ) => (subCreate, value) => {
      const values = [key, value];
      const subContext = { scope: [otherScope], current: [otherCurrent] };
      keys.forEach((key, i) => {
        if (key) {
          subContext.scope[0] = create(
            assign([subContext.scope[0], values[i], key], true, true),
          );
        }
      });
      const result = build(config, subCreate, subContext, outputNode);
      return [result, subContext.scope[0], subContext.current[0]];
    };
    const other = otherMap();
    context.current[0] = create(
      streamMap(([current]) => ({
        type: 'list',
        value: {
          ...(current.value || { indices: [], values: {} }),
          other: info.map ? otherMap : other,
          otherMap: info.map && (isPure(outputNode) ? 'pure' : true),
        },
      }))([context.current[0]]),
    );
    return { type: 'nil' };
  }
  if (type === 'assign') {
    if (
      !nodes[1] &&
      (nodes[0].type === 'assign' || nodes[0].type === 'other')
    ) {
      return build(config, create, context, nodes[0]);
    }
    const args = nodes.map(n => build(config, create, context, n));
    [context.scope, context.current].forEach(l => {
      l[0] = create(assign([l[0], ...args], info.unpack, true));
    });
    return { type: 'nil' };
  }
  if (type === 'copy') {
    const args = nodes.map(n => build(config, create, context, n));
    return create(({ get }) => {
      const dest = get(args[1]);
      let source = get(args[0]);
      return {
        initial: { type: 'nil' },
        update: () => {
          const newSource = get(args[0]);
          if (dest.set && source !== newSource) dest.set(newSource);
          source = newSource;
        },
      };
    });
  }
  if (type === 'interpret') {
    const func = config['@'] && config['@'][info.level - 1];
    if (!func) return { type: 'nil' };
    const arg = build(config, create, context, nodes[0]);
    return create(func(arg));
  }
  if (type === 'core') {
    const args = nodes.map(n => build(config, create, context, n));
    if (info.func === '$') {
      return create(
        streamMap(([code], create) => {
          const subContext = {
            scope: [args[1]],
            current: [{ type: 'list', value: { indices: [], values: {} } }],
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
    return create(({ get, output }) => {
      const run = () => {
        const value = toTypedValue(get(arg));
        if (value.integer) {
          return {
            type: 'list',
            value: {
              indices: Array.from({ length: value.value }).map((_, i) =>
                toData(i + 1),
              ),
              values: {},
            },
          };
        }
        if (value.type === 'value') {
          const func = config['#'] && config['#'][value.value];
          return func ? create(func) : { type: 'nil' };
        }
        const { indices, values } = get(arg, true).value;
        return toData(
          indices.filter(x => x).length +
            Object.keys(values).filter(k => values[k].value.type !== 'nil')
              .length,
        );
      };
      return { initial: run(), update: () => output(run()) };
    });
  }
  if (type === 'list') {
    if (info.bracket !== '[') {
      return build(config, create, context, {
        type: 'combine',
        info: { dot: true },
        nodes: [
          {
            type: 'value',
            info: {
              value: `${
                info.bracket === '('
                  ? nodes.filter(n => n.type !== 'other').length
                  : 1
              }`,
            },
          },
          { type: 'list', info: { bracket: '[' }, nodes },
        ],
      });
    }
    context.scope.unshift(create(core.clearIndices([context.scope[0]])));
    context.current.unshift(
      create(
        core.constant({ type: 'list', value: { indices: [], values: {} } }),
      ),
    );
    nodes.forEach(n =>
      build(config, create, context, { type: 'assign', nodes: [n] }),
    );
    context.scope.shift();
    return context.current.shift();
  }
  if (type === 'combine') {
    const args = nodes.map(n => build(config, create, context, n));
    return args.reduce((a1, a2, i) => {
      const argPair = [a1, a2];
      if (argPair.includes(context.scope[0])) {
        const v = create(core.constant({ type: 'nil' }));
        const k = argPair[argPair[0] === context.scope[0] ? 1 : 0];
        [context.scope, context.current].forEach(l => {
          l[0] = create(
            streamMap(([list, key]) => {
              if (list.other) return list;
              const listValue = list.value || { indices: [], values: {} };
              const res = { ...listValue };
              if (key.type !== 'list') {
                const objKey = toKey(key);
                if (typeof objKey === 'string' && !res.values[objKey]) {
                  res.values = { ...res.values };
                  res.values[objKey] = { key, value: v };
                }
              }
              return { type: 'list', value: res };
            })([l[0], k]),
          );
        });
        argPair[argPair[0] === context.scope[0] ? 0 : 1] = context.scope[0];
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
    return create(core.constant({ type: 'value', value: info.value }));
  }
  if (type === 'nil') {
    return create(core.constant({ type: 'nil' }));
  }
  if (type === 'context') {
    return context.scope[0];
  }
  if (type === 'comment') {
    return { type: 'nil' };
  }
};

export default build;
