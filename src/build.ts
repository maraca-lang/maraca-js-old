import core, { streamMap } from './core';
import { resolve, resolveDeep, setOther, toData, toTypedValue } from './data';
import combine from './combine';
import parse from './parse';
import process from './process';

const evalDataMap = map => (value, { output }) => ({
  initial: toData(map(value)),
  input: value => output(toData(map(value))),
});

const evalContext = {
  time: evalDataMap(x => {
    const v = toTypedValue(x);
    if (v.type !== 'time') return null;
    return [
      `${v.value.getDate()}`.padStart(2, '0'),
      `${v.value.getMonth() + 1}`.padStart(2, '0'),
      `${v.value.getFullYear()}`.slice(2),
    ].join('/');
  }),
  size: evalDataMap(
    x =>
      x.type === 'list'
        ? x.value.indices.filter(x => x).length +
          Object.keys(x.value.values).length
        : '0',
  ),
};

const evalInContext = code =>
  new Function(...Object.keys(evalContext), `return ${code}`)(
    ...Object.values(evalContext),
  );

const build = (queue, context, config) => {
  if (config.type === 'other') {
    const args = [context.current[0], context.scope[0]];
    let type = config.key ? '=>' : '=>>';
    if (config.key && config.key !== true) {
      args.push(build(queue, context, config.key));
      type = 'k=>';
    }
    if (config.value && config.value !== true) {
      args.push(build(queue, context, config.value));
      type = type === 'k=>' ? 'k=>v=>' : 'v=>>';
    }
    context.current[0] = streamMap(
      (current, scope, ...keys) =>
        setOther(
          current,
          ([result, ...values], output) =>
            process(
              {
                values: [
                  result,
                  scope,
                  ...keys.reduce((res, k, i) => [...res, values[i], k], []),
                ],
                output,
              },
              queue => {
                const ctx = { scope: [1], current: [0] };
                keys.forEach(
                  (_, i) =>
                    (ctx.scope[0] = core.set(true)(queue, [
                      ctx.scope[0],
                      2 + 2 * i,
                      3 + 2 * i,
                    ])),
                );
                const result = build(queue, ctx, config.output);
                return [ctx.current[0], result];
              },
            ),
          type,
        ),
      true,
    )(queue, args);
    return core.constant(queue, { type: 'nil' });
  }
  if (config.type === 'set') {
    if (
      !config.args[1] &&
      !Array.isArray(config.args[0]) &&
      (config.args[0].type === 'set' || config.args[0].type === 'other')
    ) {
      return build(queue, context, config.args[0]);
    }
    const map = core.set(config.unpack);
    const args = config.args.map(c => build(queue, context, c));
    context.scope[0] = map(queue, [context.scope[0], ...args]);
    context.current[0] = map(queue, [context.current[0], ...args]);
    return core.constant(queue, { type: 'nil' });
  }
  if (config.type === 'core') {
    return core[config.func](
      queue,
      config.args.map(c => build(queue, context, c)),
    );
  }
  if (config.type === 'merge') {
    const args = config.args.map(c => build(queue, context, c)).reverse();
    return queue(1, ({ get, output }) => {
      let prev = [];
      const run = () => {
        const values = args.map(a => resolve(a, get));
        const changed = values.findIndex((v, i) => v !== prev[i]);
        const setters = values.filter(v => v.set);
        prev = values;
        return {
          ...values[changed],
          ...(setters.length === 1 ? { set: setters[0].set } : {}),
        };
      };
      return { initial: [run()], input: () => output(0, run()) };
    });
  }
  if (config.type === 'eval') {
    const code = build(queue, context, config.code);
    const arg = build(queue, context, config.arg);
    return queue(1, ({ get, output }) => {
      let stop;
      const run = () => {
        if (stop) stop();
        const codeValue = resolveDeep(get(code), get);
        const result = process(
          { values: [resolveDeep(get(arg), get)], output },
          queue => [
            build(
              queue,
              { scope: [0], current: [0] },
              parse(codeValue.type === 'value' ? codeValue.value : ''),
            ),
          ],
        );
        stop = result.stop;
        return result.initial[0];
      };
      return { initial: [run()], input: () => output(0, run()) };
    });
  }
  if (config.type === 'js') {
    const map =
      config.code.type === 'value'
        ? evalInContext(config.code.value)
        : () => ({ initial: { type: 'nil' } });
    const arg = build(queue, context, config.arg);
    return queue(1, ({ get, output }) => {
      const { initial, input } = map(resolve(arg, get), {
        get,
        output: v => output(0, v),
      });
      return {
        initial: [initial],
        input: () => {
          if (input) input(resolve(arg, get));
        },
      };
    })[0];
  }
  if (config.type === 'combine') {
    const args = config.args.map(c => build(queue, context, c));
    return queue(1, ({ get, output }) => {
      const { initial, input } = combine(
        resolve(args[0], get),
        resolve(args[1], get),
        get,
        v => output(0, v),
        config.tight,
      );
      return {
        initial: [initial],
        input: () => input(resolve(args[0], get), resolve(args[1], get)),
      };
    })[0];
  }
  if (config.type === 'list') {
    if (config.bracket !== '[') {
      return build(queue, context, {
        type: 'combine',
        args: [
          toData(config.bracket === '(' ? config.values.length : 1),
          { ...config, bracket: '[' },
        ],
      });
    }
    context.scope.unshift(core.clearIndices(queue, [context.scope[0]]));
    context.current.unshift(core.constant(queue, { type: 'nil' }));
    config.values.forEach(c =>
      build(queue, context, { type: 'set', args: [c] }),
    );
    context.scope.shift();
    return context.current.shift();
  }
  if (config.type === 'any') {
    return queue(1, ({ output }) => {
      const set = v => output(0, { ...toData(v), set });
      return { initial: [{ type: 'nil', set }] };
    })[0];
  }
  if (['value', 'nil'].includes(config.type)) {
    return core.constant(queue, config);
  }
  if (config.type === 'context') {
    return context.scope[0];
  }
};

export default build;
