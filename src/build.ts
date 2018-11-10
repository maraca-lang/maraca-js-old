import core, { streamMap } from './core';
import { resolve, resolveDeep, setOther, toData } from './data';
import combine from './combine';
import parse from './parse';
import process from './process';

const evalInContext = (methods, code) =>
  new Function(...Object.keys(methods), `return ${code}`)(
    ...Object.values(methods),
  );

const build = (methods, queue, context, config) => {
  if (config.type === 'other') {
    const args = [context.current[0], context.scope[0]];
    let type = config.key ? '=>' : '=>>';
    if (config.key && config.key !== true) {
      args.push(build(methods, queue, context, config.key));
      type = 'k=>';
    }
    if (config.value && config.value !== true) {
      args.push(build(methods, queue, context, config.value));
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
                const result = build(methods, queue, ctx, config.output);
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
      (config.args[0].type === 'set' || config.args[0].type === 'other')
    ) {
      return build(methods, queue, context, config.args[0]);
    }
    const map = core.set(config.unpack);
    const args = config.args.map(c => build(methods, queue, context, c));
    context.scope[0] = map(queue, [context.scope[0], ...args]);
    context.current[0] = map(queue, [context.current[0], ...args]);
    return core.constant(queue, { type: 'nil' });
  }
  if (config.type === 'core') {
    return core[config.func](
      queue,
      config.args.map(c => build(methods, queue, context, c)),
    );
  }
  if (config.type === 'eval') {
    const code = build(methods, queue, context, config.code);
    const arg = build(methods, queue, context, config.arg);
    return queue(1, ({ get, output }) => {
      let stop;
      const run = () => {
        if (stop) stop();
        const codeValue = resolveDeep(get(code), get);
        const result = process(
          { values: [resolveDeep(get(arg), get)], output },
          queue => [
            build(
              methods,
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
        ? evalInContext(methods, config.code.value)
        : () => ({ initial: { type: 'nil' } });
    const arg = build(methods, queue, context, config.arg);
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
    const args = config.args.map(c => build(methods, queue, context, c));
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
      return build(methods, queue, context, {
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
    context.scope.unshift(core.clearIndices(queue, [context.scope[0]]));
    context.current.unshift(core.constant(queue, { type: 'nil' }));
    config.values.forEach(c =>
      build(methods, queue, context, { type: 'set', args: [c] }),
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
