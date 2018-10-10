import combine from './combine';
import { binary, unary } from './core';
import { toData } from './data';
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

const valueStream = build => ({ initial: first, output }) => {
  const ctx = [...first];
  const values = ctx.splice(0, ctx.length - 2);
  const { initial, input } = build({
    initial: values,
    output: (index, value) => output(index, value),
  });
  return {
    initial: [initial[0], ...ctx],
    input: updates => {
      if (updates) {
        updates.forEach(u => {
          if (u[0] < 2) input([u]);
          else output(u[0] - values.length + 1, u[1], u[2]);
        });
      }
    },
  };
};

const build = (queue, context, config) => {
  if (Array.isArray(config)) {
    const result = queue(
      [
        ...config.map(c => build(queue, context, c)),
        context.scope[0],
        context.current[0],
      ],
      combine,
    );
    context.scope[0] = result[1];
    context.current[0] = result[2];
    return result[0];
  }
  if (config.type === 'set') {
    if (
      !config.key &&
      !Array.isArray(config.value) &&
      config.value.type === 'set'
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
          context.scope[0],
          context.current[0],
          build(queue, context, config.key),
          build(queue, context, config.value),
        ],
        ([scope, current, key, value]) =>
          binary.other([
            current,
            valueStream(({ initial, output }) =>
              process(
                { initial: [...initial, scope, key, value], output },
                queue => [
                  build(
                    queue,
                    {
                      scope: [
                        streamMap(
                          queue,
                          [streamMap(queue, [2, 0, 3], binary.assign), 1, 4],
                          binary.assign,
                        ),
                      ],
                      current: [constant(queue, { type: 'nil' })],
                    },
                    config.output,
                  ),
                ],
              ),
            ),
            'keyValue',
          ]),
      );
    } else if (config.key === true || config.value === true) {
      context.current[0] = streamMap(queue, [context.current[0]], ([current]) =>
        binary.other([
          current,
          ({ initial, output }) =>
            process({ initial, output }, queue => {
              const ctx = { arg: 0, scope: [1], current: [2] };
              const res = build(queue, ctx, config.output);
              return [res, ctx.scope[0], ctx.current[0]];
            }),
          config.key ? 'key' : 'value',
        ]),
      );
    } else {
      context.current[0] = streamMap(
        queue,
        [
          context.scope[0],
          context.current[0],
          build(queue, context, config.key || config.value),
        ],
        ([scope, current, key]) =>
          binary.other([
            current,
            valueStream(({ initial, output }) =>
              process({ initial: [...initial, scope, key], output }, queue => [
                build(
                  queue,
                  {
                    scope: [streamMap(queue, [1, 0, 2], binary.assign)],
                    current: [constant(queue, { type: 'nil' })],
                  },
                  config.output,
                ),
              ]),
            ),
            config.key ? 'key' : 'value',
          ]),
      );
    }
    return constant(queue, { type: 'nil' });
  }
  if (config.type === 'merge') {
    return queue(
      config.args.map(c => build(queue, context, c)),
      ({ initial, output }) => {
        const pushes = initial.filter(i => i.push);
        return {
          initial: [
            {
              ...initial[initial.length - 1],
              ...(pushes.length === 1 ? { push: pushes[0].push } : {}),
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
  if (config.type === 'table') {
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
    return context.arg === undefined ? context.scope[0] : context.arg;
  }
};

export default build;
