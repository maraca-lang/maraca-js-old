import combine from './combine';
import core, { streamMap } from './core';
import { setOther, toData } from './data';
import parse from './parse';
import { createIndexer, watchStreams } from './process';

const evalInContext = (methods, code) =>
  new Function(...Object.keys(methods), `return ${code}`)(
    ...Object.values(methods),
  );

const build = (methods, create, indexer, context, config) => {
  if (config.type === 'other') {
    const scope = context.scope[0];
    const keys: any[] = [];
    let type = config.key ? '=>' : '=>>';
    if (config.key && config.key !== true) {
      keys.push(build(methods, create, indexer, context, config.key));
      type = 'k=>';
    }
    if (config.value && config.value !== true) {
      keys.push(build(methods, create, indexer, context, config.value));
      type = type === 'k=>' ? 'k=>v=>' : 'v=>>';
    }
    context.current[0] = streamMap(
      current =>
        setOther(
          current,
          (index, [list, ...values], output) => {
            const subIndexer = createIndexer(index);
            const subContext = { scope: [scope], current: [list] };
            keys.forEach((key, i) => {
              subContext.scope[0] = core.set(true)(create, subIndexer(), [
                subContext.scope[0],
                values[i],
                key,
              ]);
            });
            const result = build(
              methods,
              create,
              subIndexer,
              subContext,
              config.output,
            );
            return watchStreams(
              create,
              subIndexer,
              [subContext.current[0], result],
              output,
            );
          },
          type,
        ),
      true,
    )(create, indexer(), [context.current[0]]);
    return { type: 'nil' };
  }
  if (config.type === 'set') {
    if (
      !config.args[1] &&
      (config.args[0].type === 'set' || config.args[0].type === 'other')
    ) {
      return build(methods, create, indexer, context, config.args[0]);
    }
    const map = core.set(config.unpack);
    const args = config.args.map(c =>
      build(methods, create, indexer, context, c),
    );
    context.scope[0] = map(create, indexer(), [context.scope[0], ...args]);
    context.current[0] = map(create, indexer(), [context.current[0], ...args]);
    return { type: 'nil' };
  }
  if (config.type === 'core') {
    return core[config.func](
      create,
      indexer(),
      config.args.map(c => build(methods, create, indexer, context, c)),
    );
  }
  if (config.type === 'eval') {
    if (config.mode === '#') {
      return config.code.type === 'value'
        ? evalInContext(methods, config.code.value)(create, indexer())
        : { type: 'nil' };
    }
    return streamMap(code =>
      setOther(
        { type: 'nil' },
        (index, [list, value], output) => {
          const subIndexer = createIndexer(index);
          const subContext = { scope: [value], current: [list] };
          const result = build(
            methods,
            create,
            subIndexer,
            subContext,
            parse(code.type === 'value' ? code.value : ''),
          );
          return watchStreams(
            create,
            subIndexer,
            [subContext.current[0], result],
            output,
          );
        },
        'k=>',
      ),
    )(create, indexer(), [
      build(methods, create, indexer, context, config.code),
    ]);
  }
  if (config.type === 'list') {
    if (config.bracket !== '[') {
      return build(methods, create, indexer, context, {
        type: 'combine',
        args: [
          toData(config.bracket === '(' ? config.values.length : 1),
          {
            type: 'list',
            bracket: '[',
            values: [
              ...config.values,
              { type: 'other', key: true, output: { type: 'nil' } },
            ],
          },
        ],
      });
    }
    context.scope.unshift(
      core.clearIndices(create, indexer(), [context.scope[0]]),
    );
    context.current.unshift(core.constant(create, indexer(), { type: 'nil' }));
    config.values.forEach(c =>
      build(methods, create, indexer, context, { type: 'set', args: [c] }),
    );
    context.scope.shift();
    return context.current.shift();
  }
  if (config.type === 'combine') {
    const index = indexer();
    return config.args
      .map(c => build(methods, create, indexer, context, c))
      .reduce((a1, a2) =>
        create(index, ({ get, output }) =>
          combine(index, a1, a2, get, output, config.tight),
        ),
      );
  }
  if (['value', 'nil'].includes(config.type)) {
    return core.constant(create, indexer(), config);
  }
  if (config.type === 'context') {
    return context.scope[0];
  }
};

export default build;
