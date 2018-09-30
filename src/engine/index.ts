import core, { asFunction } from './core';
import { table } from './data';
import stream from './stream';

const process = (config, scope) => {
  if (typeof config === 'function') return config;
  if (Array.isArray(config)) {
    const [func, value] = config;
    const func$ = process(func, scope);
    const value$ = process(value, scope);
    const { context, current } = scope;
    scope.context = stream.flatMap(func$, data => {
      const f = asFunction(data);
      return f.length === 2 ? f(value$, context) : context;
    });
    scope.current = stream.flatMap(func$, data => {
      const f = asFunction(data);
      return f.length === 2 ? f(value$, current) : current;
    });
    return stream.flatMap(func$, data => {
      const f = asFunction(data);
      return f.length === 2 ? stream.constant({ type: 'nil' }) : f(value$);
    });
  }
  const { type, value } = config;
  if (type === 'function') {
    const { input, output } = value;
    return stream.constant({
      type: 'function',
      value: stream$ =>
        process(
          [
            { type: 'string', value: '-' },
            {
              type: 'table',
              value: [
                [[{ type: 'function', value: ':=' }, input], stream$],
                output,
              ],
            },
          ],
          scope,
        ),
    });
  }
  if (type === 'table') return run(value, scope.context);
  if (type === 'core') {
    return stream.constant({ type: 'function', value: core[value] });
  }
  if (type === 'string' || type === 'nil') {
    return stream.constant({ type, value });
  }
  if (type === 'context') return scope.context;
};

const run = (configArray, context) => {
  const scope = {
    context,
    current: stream.constant({
      type: 'table',
      value: table.empty(),
    }),
  };
  configArray.forEach(config => process(config, scope));
  return stream.map(
    scope.current,
    data =>
      Object.keys(data.value.values).length === 0 ? { type: 'nil' } : data,
  );
};

export default config =>
  run(config, stream.constant({ type: 'table', value: table.empty() }));
