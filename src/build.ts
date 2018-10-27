import combine from './combine';
import { binary, unary } from './core';
import { toData, toTypedValue } from './data';
import parse from './parse';
import process from './process';

const constant = (queue, value) => queue([], () => ({ initial: [value] }))[0];

const streamMap = (queue, args, map) =>
  queue(args, ({ initial, output }) => {
    let values = initial;
    return {
      initial: [map(values)],
      input: updates => {
        updates.forEach(([index, value]) => {
          values[index] = value;
        });
        output(0, map(values));
      },
    };
  })[0];

const evalContext = {
  time: x => {
    const v = toTypedValue(x);
    if (v.type !== 'time') return null;
    return [
      `${v.value.getDate()}`.padStart(2, '0'),
      `${v.value.getMonth() + 1}`.padStart(2, '0'),
      `${v.value.getFullYear()}`.slice(2),
    ].join('/');
  },
  size: x =>
    x.type === 'list'
      ? x.value.indices.filter(x => x).length +
        Object.keys(x.value.values).length
      : '0',
};

const evalInContext = code =>
  new Function(...Object.keys(evalContext), `return ${code}`)(
    ...Object.values(evalContext),
  );

const build = (queue, context, config) => {
  if (Array.isArray(config)) {
    return queue(config.map(c => build(queue, context, c)), combine)[0];
  }
  if (config.type === 'set') {
    if (
      !config.key &&
      !Array.isArray(config.value) &&
      (config.value.type === 'set' || config.value.type === 'other')
    ) {
      return build(queue, context, config.value);
    }
    let map: any = binary.assign;
    const args = [build(queue, context, config.value)];
    if (config.key) {
      if (config.key === true) {
        map = binary.unpack;
      } else {
        args.push(build(queue, context, config.key));
      }
    }
    context.scope[0] = streamMap(queue, [context.scope[0], ...args], map);
    context.current[0] = streamMap(queue, [context.current[0], ...args], map);
    return constant(queue, { type: 'nil' });
  }
  if (config.type === 'other') {
    if (config.key && config.value) {
      context.current[0] = streamMap(
        queue,
        [
          context.current[0],
          context.scope[0],
          build(queue, context, config.key),
          build(queue, context, config.value),
        ],
        ([current, scope, k, v]) =>
          binary.other([
            current,
            ({ initial: [result, key, value], output }) =>
              process(
                { initial: [result, scope, key, k, value, v], output },
                queue => {
                  const ctx = {
                    scope: [
                      streamMap(
                        queue,
                        [streamMap(queue, [1, 2, 3], binary.assign), 4, 5],
                        binary.assign,
                      ),
                    ],
                    current: [0],
                  };
                  const result = build(queue, ctx, config.output);
                  return [ctx.current[0], result];
                },
              ),
            'k=>v=>',
          ]),
      );
    } else if (config.key === true || config.value === true) {
      context.current[0] = streamMap(
        queue,
        [context.current[0], context.scope[0]],
        ([current, scope]) =>
          binary.other([
            current,
            ({ initial: [result], output }) =>
              process({ initial: [result, scope], output }, queue => {
                const ctx = { scope: [1], current: [0] };
                const result = build(queue, ctx, config.output);
                return [ctx.current[0], result];
              }),
            config.key ? '=>' : '=>>',
          ]),
      );
    } else {
      context.current[0] = streamMap(
        queue,
        [
          context.current[0],
          context.scope[0],
          build(queue, context, config.key || config.value),
        ],
        ([current, scope, v]) =>
          binary.other([
            current,
            ({ initial: [result, value], output }) =>
              process({ initial: [result, scope, value, v], output }, queue => {
                const ctx = {
                  scope: [streamMap(queue, [1, 2, 3], binary.assign)],
                  current: [0],
                };
                const result = build(queue, ctx, config.output);
                return [ctx.current[0], result];
              }),
            config.key ? 'k=>' : 'v=>>',
          ]),
      );
    }
    return constant(queue, { type: 'nil' });
  }
  if (config.type === 'merge') {
    return queue(
      config.args.map(c => build(queue, context, c)),
      ({ initial, output }) => {
        const setters = initial.filter(i => i.set);
        return {
          initial: [
            {
              ...initial[initial.length - 1],
              ...(setters.length === 1 ? { set: setters[0].set } : {}),
            },
          ],
          input: update => output(0, update[update.length - 1][1]),
        };
      },
    );
  }
  if (config.type === 'binary') {
    return streamMap(
      queue,
      config.args.map(c => build(queue, context, c)),
      binary[config.func],
    );
  }
  if (config.type === 'unary') {
    return queue([build(queue, context, config.arg)], unary[config.func])[0];
  }
  if (config.type === 'eval') {
    return queue(
      [build(queue, context, config.code), build(queue, context, config.arg)],
      ({ initial, output }) => {
        let values = initial;
        let current;
        const runEval = () => {
          current = process({ initial: [initial[1]], output }, queue => [
            build(
              queue,
              { scope: [0], current: [0] },
              parse(initial[0].type === 'string' ? initial[0].value : ''),
            ),
          ]);
        };
        runEval();
        return {
          initial: current.initial,
          input: updates => {
            if (updates) {
              updates.forEach(u => (values[u[0]] = u[1]));
              if (updates.some(u => u[0] === 0)) {
                current.input();
                runEval();
                current.initial.forEach((v, i) => output(i, v));
              } else {
                current.input(updates.map(u => [u[0] - 1, u[1], u[2]]));
              }
            } else {
              current.input();
            }
          },
        };
      },
    )[0];
  }
  if (config.type === 'js') {
    const map =
      config.code.type === 'string' ? evalInContext(config.code.value) : x => x;
    return streamMap(queue, [build(queue, context, config.arg)], ([value]) =>
      toData(map(value)),
    );
  }
  if (config.type === 'list') {
    context.scope.unshift(
      streamMap(queue, [context.scope[0]], binary.clearIndices),
    );
    context.current.unshift(constant(queue, { type: 'nil' }));
    config.values.forEach(c => build(queue, context, c));
    context.scope.shift();
    return context.current.shift();
  }
  if (['string', 'nil'].includes(config.type)) {
    return constant(queue, config);
  }
  if (config.type === 'any') {
    return queue([], ({ output }) => {
      const set = v => output(0, { ...toData(v), set });
      return { initial: [{ type: 'nil', set }] };
    })[0];
  }
  if (config.type === 'context') {
    return context.scope[0];
  }
};

export default build;
