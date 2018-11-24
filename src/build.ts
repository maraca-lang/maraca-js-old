import assign from './assign';
import combine from './combine';
import core, { streamMap } from './core';
import { setOther, toData } from './data';
import parse from './parse';
import { createIndexer } from './process';

const evalInContext = (library, code) =>
  new Function(...Object.keys(library), `return ${code}`)(
    ...Object.values(library),
  );

const build = (config, create, indexer, context, node) => {
  if (node.type === 'other') {
    const scope = context.scope[0];
    const keys: any[] = [];
    let type = node.key ? '=>' : '=>>';
    if (node.key && node.key !== true) {
      keys.push(build(config, create, indexer, context, node.key));
      type = 'k=>';
    }
    if (node.value && node.value !== true) {
      keys.push(build(config, create, indexer, context, node.value));
      type = type === 'k=>' ? 'k=>v=>' : 'v=>>';
    }
    const other = (index, [list, ...values]) => {
      const subIndexer = createIndexer(index);
      const subContext = { scope: [scope], current: [list] };
      keys.forEach((key, i) => {
        subContext.scope[0] = assign(true)(create, subIndexer(), [
          subContext.scope[0],
          values[i],
          key,
        ]);
      });
      const result = build(config, create, subIndexer, subContext, node.output);
      return [subContext.current[0], result];
    };
    context.current[0] = streamMap(current => setOther(current, other, type))(
      create,
      indexer(),
      [context.current[0]],
    );
    return { type: 'nil' };
  }
  if (node.type === 'set') {
    if (
      !node.args[1] &&
      (node.args[0].type === 'set' || node.args[0].type === 'other')
    ) {
      return build(config, create, indexer, context, node.args[0]);
    }
    const map = assign(node.unpack);
    const args = node.args.map(n => build(config, create, indexer, context, n));
    context.scope[0] = map(create, indexer(), [context.scope[0], ...args]);
    context.current[0] = map(create, indexer(), [context.current[0], ...args]);
    return { type: 'nil' };
  }
  if (node.type === 'dynamic') {
    if (!config.dynamics[node.level - 1]) return { type: 'nil' };
    const arg = build(config, create, indexer, context, node.arg);
    return create(indexer(), config.dynamics[node.level - 1](arg));
  }
  if (node.type === 'core') {
    const args = node.args.map(n => build(config, create, indexer, context, n));
    return core[node.func](create, indexer(), args);
  }
  if (node.type === 'eval') {
    if (node.mode === '#') {
      return node.code.type === 'value'
        ? evalInContext(config.library, node.code.value)
        : { type: 'nil' };
    }
    const code = build(config, create, indexer, context, node.code);
    return streamMap(code =>
      setOther(
        { type: 'nil' },
        (index, [list, value]) => {
          const subIndexer = createIndexer(index);
          const subContext = { scope: [value], current: [list] };
          let parsed = { type: 'nil' };
          try {
            parsed = parse(code.type === 'value' ? code.value : '');
          } catch (e) {
            console.log(e.message);
          }
          const result = build(config, create, subIndexer, subContext, parsed);
          return [subContext.current[0], result];
        },
        'k=>',
      ),
    )(create, indexer(), [code]);
  }
  if (node.type === 'list') {
    if (node.bracket !== '[') {
      return build(config, create, indexer, context, {
        type: 'combine',
        args: [
          toData(
            node.bracket === '('
              ? node.values.filter(n => n.type !== 'other').length
              : 1,
          ),
          {
            type: 'list',
            bracket: '[',
            values: [
              { type: 'other', key: true, output: { type: 'nil' } },
              ...node.values,
            ],
          },
        ],
      });
    }
    context.scope.unshift(
      core.clearIndices(create, indexer(), [context.scope[0]]),
    );
    context.current.unshift(core.constant(create, indexer(), { type: 'nil' }));
    node.values.forEach(n =>
      build(config, create, indexer, context, { type: 'set', args: [n] }),
    );
    context.scope.shift();
    return context.current.shift();
  }
  if (node.type === 'combine') {
    const args = node.args.map(n => build(config, create, indexer, context, n));
    return args.reduce((a1, a2) => {
      const index = indexer();
      return create(index, ({ get, output }) =>
        combine(create, index, a1, a2, node.tight, get, output),
      );
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
};

export default build;
