import { toData, toDateData, toKey } from './data';
import maps from './maps';
import process from './process';
import toFunc from './toFunc';

const constant = (queue, value) => queue([], () => ({ initial: [value] }))[0];

const streamMap = map => ({ initial, output }) => {
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
};

const assignStream = ({ initial, output }) => {
  let values = initial;
  const getKey = () => {
    const indices = values[0].value ? values[0].value.indices : [];
    if (!initial[2]) return (indices[indices.length - 1] || 0) + 1;
    return toKey(initial[2], indices);
  };
  let prevKey = getKey();
  return {
    initial: [maps.assign(initial)],
    input: updates => {
      updates.forEach(u => (values[u[0]] = u[1]));
      const nextKey = getKey();
      const changed = {
        ...((updates.find(u => u[0] === 0) || [])[2] || {}),
        [prevKey]: nextKey !== prevKey,
        [nextKey]:
          nextKey !== prevKey || (updates.find(u => u[0] === 1) || [])[2],
      };
      prevKey = nextKey;
      output(0, maps.assign(values), changed);
    },
  };
};

const valueStream = build => ({ initial: [value, scope, current], output }) => {
  const { initial, input } = build({
    initial: value,
    output: value => output(0, value),
  });
  return {
    initial: [initial, scope, current],
    input: updates => {
      updates.forEach(([i, v, c]) => {
        if (i === 0) input(v, c);
        else output(i, v, c);
      });
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
      ({ initial: [func, ...args], output }) => {
        let { initial, input } = toFunc(func)({ initial: args, output });
        let currentArgs = args;
        return {
          initial,
          input: updates => {
            let f = updates.find(u => u[0] === 0);
            updates.forEach(u => {
              if (u[0] !== 0) currentArgs[u[0] - 1] = u[1];
            });
            if (f) {
              ({ initial, input } = toFunc(f[1])({
                initial: currentArgs,
                output,
              }));
              initial.forEach((v, i) => output(i, v));
            } else {
              input(updates.map(([i, v, c]) => [i - 1, v, c]));
            }
          },
        };
      },
    );
    context.scope[0] = result[1];
    context.current[0] = result[2];
    return result[0];
  }
  if (config.type === 'function') {
    if (config.input) {
      return queue(
        [context.scope[0], build(queue, context, config.input)],
        streamMap(([scope, input]) => ({
          type: 'function',
          value: valueStream(({ initial, output }) =>
            process(
              {
                initial: [initial, scope, input],
                output: (_, value, changed) => output(value, changed),
              },
              queue => [
                build(
                  queue,
                  {
                    scope: [queue([1, 0, 2], streamMap(maps.assign))],
                    current: [constant(queue, { type: 'nil' })],
                  },
                  config.output,
                ),
              ],
            ),
          ),
        })),
      )[0];
    }
    return constant(queue, {
      type: 'function',
      value: ({ initial, output }) =>
        process({ initial, output }, queue => {
          const ctx = { arg: 0, scope: [1], current: [2] };
          const res = build(queue, ctx, config.output);
          return [res, ctx.scope[0], ctx.current[0]];
        }),
    });
  }
  if (config.type === 'table') {
    context.scope.unshift(
      queue([context.scope[0]], streamMap(maps.clearIndices))[0],
    );
    context.current.unshift(constant(queue, { type: 'nil' }));
    config.values.forEach(c => build(queue, context, c));
    context.scope.shift();
    return context.current.shift();
  }
  if (config.type === 'assign') {
    let map: any = assignStream;
    let fill = false;
    const args = [build(queue, context, config.value)];
    if (config.key) {
      if (config.key.type === 'any') {
        fill = true;
        map = streamMap(maps[config.key.group ? 'fillGroup' : 'fill']);
      } else {
        args.push(build(queue, context, config.key));
      }
    }
    if (config.all) map = streamMap(maps.unpack);
    if (!fill) {
      context.scope[0] = queue([context.scope[0], ...args], map)[0];
    }
    context.current[0] = queue([context.current[0], ...args], map)[0];
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
  if (config.type === 'map') {
    return queue(
      config.args.map(c => build(queue, context, c)),
      streamMap(maps[config.map]),
    )[0];
  }
  if (config.type === 'count') {
    return queue([build(queue, context, config.arg)], ({ output }) => {
      let count = 0;
      return {
        initial: [toData(count)],
        input: () => output(0, toData(++count)),
      };
    })[0];
  }
  if (config.type === 'date') {
    return queue([build(queue, context, config.arg)], ({ initial, output }) => {
      let value = initial[0];
      const interval = setInterval(() => output(0, toDateData(value)), 1000);
      return {
        initial: [toDateData(value)],
        input: updates => {
          if (!updates) {
            clearInterval(interval);
          } else {
            value = updates[0].value;
            output(0, toDateData(value));
          }
        },
      };
    })[0];
  }
  if (['string', 'nil'].includes(config.type)) {
    return constant(queue, config);
  }
  if (config.type === 'any') {
    return queue([], ({ output }) => ({
      initial: [{ type: 'nil', set: v => output(0, toData(v)) }],
    }))[0];
  }
  if (config.type === 'context') {
    return context.arg === undefined ? context.scope[0] : context.arg;
  }
};

export default build;
