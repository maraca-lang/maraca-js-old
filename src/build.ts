import assign from './assign';
import combine from './combine';
import core, { streamMap } from './core';
import { toData, toKey } from './data';
import parse from './parse';
import { createIndexer } from './process';

const evalInContext = (library, code) => {
  try {
    return new Function(...Object.keys(library), `return ${code}`)(
      ...Object.values(library),
    );
  } catch {
    return { type: 'nil' };
  }
};

const structure = {
  other: ['key', 'value', 'output'],
  assign: ['args'],
  copy: ['args'],
  dynamic: ['arg'],
  core: ['args'],
  lib: ['arg'],
  list: ['values'],
  combine: ['args'],
};

const isPure = node => {
  if (['assign', 'other'].includes(node.type)) return false;
  if (node.type === 'list') return true;
  return (structure[node.type] || []).every(k =>
    Array.isArray(node[k]) ? node[k].every(isPure) : isPure(node[k]),
  );
};

const build = (config, create, indexer, context, node) => {
  if (node.type === 'other') {
    const scope = context.scope[0];
    const keys = [node.key, node.value].map(
      n => n && build(config, create, indexer, context, n),
    );
    const otherMap = (
      otherScope = scope,
      otherCurrent = { type: 'list', value: { indices: [], values: {} } },
      key?,
    ) => (index, value) => {
      const values = [key, value];
      const subIndexer = createIndexer(index);
      const subContext = { scope: [otherScope], current: [otherCurrent] };
      keys.forEach((key, i) => {
        if (key) {
          subContext.scope[0] = assign(
            create,
            subIndexer(),
            [subContext.scope[0], values[i], key],
            true,
            true,
          );
        }
      });
      const result = build(config, create, subIndexer, subContext, node.output);
      return [result, subContext.scope[0], subContext.current[0]];
    };
    const other = otherMap();
    context.current[0] = streamMap(current => ({
      type: 'list',
      value: {
        ...(current.value || { indices: [], values: {} }),
        other: node.map ? otherMap : other,
        otherMap: node.map && (isPure(node.output) ? 'pure' : true),
      },
    }))(create, indexer(), [context.current[0]]);
    return { type: 'nil' };
  }
  if (node.type === 'assign') {
    if (
      !node.args[1] &&
      (node.args[0].type === 'assign' || node.args[0].type === 'other')
    ) {
      return build(config, create, indexer, context, node.args[0]);
    }
    const args = node.args.map(n => build(config, create, indexer, context, n));
    [context.scope, context.current].forEach(l => {
      l[0] = assign(create, indexer(), [l[0], ...args], node.unpack, true);
    });
    return { type: 'nil' };
  }
  if (node.type === 'copy') {
    const args = node.args.map(n => build(config, create, indexer, context, n));
    return create(indexer(), ({ get }) => {
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
  if (node.type === 'dynamic') {
    if (!config.dynamics[node.level - 1]) return { type: 'nil' };
    const arg = build(config, create, indexer, context, node.arg);
    return create(indexer(), config.dynamics[node.level - 1](arg));
  }
  if (node.type === 'core') {
    const args = node.args.map(n => build(config, create, indexer, context, n));
    const index = indexer();
    if (node.func === '$') {
      return streamMap(code => {
        const subIndexer = createIndexer(index);
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
        return build(config, create, subIndexer, subContext, parsed);
      })(create, index, [args[0]]);
    }
    return core[node.func](create, index, args);
  }
  if (node.type === 'lib') {
    const arg = build(config, create, indexer, context, node.arg);
    return create(indexer(), ({ get, output }) => {
      const run = () => {
        const value = get(arg);
        if (value.type !== 'list') {
          return value.type === 'nil'
            ? { type: 'nil' }
            : evalInContext(config.library, value.value);
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
  if (node.type === 'list') {
    if (node.bracket !== '[') {
      return build(config, create, indexer, context, {
        type: 'combine',
        dot: true,
        args: [
          toData(
            node.bracket === '('
              ? node.values.filter(n => n.type !== 'other').length
              : 1,
          ),
          { type: 'list', bracket: '[', values: node.values },
        ],
      });
    }
    context.scope.unshift(
      core.clearIndices(create, indexer(), [context.scope[0]]),
    );
    context.current.unshift(
      core.constant(create, indexer(), {
        type: 'list',
        value: { indices: [], values: {} },
      }),
    );
    node.values.forEach(n =>
      build(config, create, indexer, context, { type: 'assign', args: [n] }),
    );
    context.scope.shift();
    return context.current.shift();
  }
  if (node.type === 'combine') {
    const args = node.args.map(n => build(config, create, indexer, context, n));
    return args.reduce((a1, a2, i) => {
      const argPair = [a1, a2];
      if (argPair.includes(context.scope[0])) {
        const v = core.constant(create, indexer(), { type: 'nil' });
        const k = argPair[argPair[0] === context.scope[0] ? 1 : 0];
        [context.scope, context.current].forEach(l => {
          l[0] = streamMap((list, key) => {
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
          })(create, indexer(), [l[0], k]);
        });
        argPair[argPair[0] === context.scope[0] ? 0 : 1] = context.scope[0];
      }
      return combine(
        create,
        indexer(),
        argPair,
        node.dot,
        node.space && node.space[i - 1],
      )[0];
    });
  }
  if (node.type === 'value') {
    return core.constant(create, indexer(), {
      type: 'value',
      value: node.value,
    });
  }
  if (node.type === 'nil') {
    return core.constant(create, indexer(), { type: 'nil' });
  }
  if (node.type === 'context') {
    return context.scope[0];
  }
  if (node.type === 'comment') {
    return { type: 'nil' };
  }
};

export default build;
