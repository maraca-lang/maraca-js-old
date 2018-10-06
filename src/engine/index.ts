import { toData, toDateData, toKey } from './data';
import maps from './maps';
import process from './process';
import toFunc from './toFunc';

const mapStream = m => ({ initial, output }) => ({
  initial: m(initial),
  update: next => output(m(next.map(a => a.value))),
});

const getKey = (k, { indices } = { indices: [] }) => {
  if (!k) return (indices[indices.length - 1] || 0) + 1;
  return toKey(k, indices);
};

const assignStream = ({ initial, output }) => {
  let prevKey = getKey(initial[2], initial[0].value);
  return {
    initial: maps.assign(initial),
    input: ([s, v, k]) => {
      const nextKey = getKey(k && k.value, s.value.value);
      const changed = {
        ...s.changed,
        [prevKey]: nextKey !== prevKey,
        [nextKey]: nextKey !== prevKey || v.changed,
      };
      prevKey = nextKey;
      output(maps.assign([s.value, v.value, k && k.value]), changed);
    },
  };
};

const build = (queue, context, config) => {
  if (Array.isArray(config)) {
    if (config[0].type === 'any') {
      return build(queue, context, {
        type: 'assign',
        value: config[1],
        all: true,
      });
    }
    return queue(
      config.map(c => build(queue, context, c)),
      ({ initial: [func, arg], output }) => {
        let { initial, input } = toFunc(func)({ initial: arg, output });
        return {
          initial,
          input: ([f, a]) => {
            if (f.changed) {
              input();
              ({ initial, input } = toFunc(f.value)({
                initial: a.value,
                output,
              }));
              output(initial);
            } else {
              input(a);
            }
          },
        };
      },
    );
  }
  if (config.type === 'function') {
    return queue(
      [context.scope[0], build(queue, context, config.input)],
      mapStream(([scope, input]) => ({
        type: 'function',
        value: ({ initial, output }) => {
          const assign = v => maps.assign([scope, input, v]);
          const result = process({ initial: assign(initial), output }, queue =>
            build(queue, { scope: [0], current: [] }, config.output),
          );
          return {
            initial: result.initial,
            input: next => result.input(assign(next)),
          };
        },
      })),
    );
  }
  if (config.type === 'table') {
    const { scope, current } = context;
    scope.unshift(queue([scope[0]], mapStream(maps.clearIndices)));
    current.unshift(queue([], () => ({ initial: { type: 'nil' } })));
    config.values.forEach(v => build(queue, context, v));
    scope.shift();
    return current.shift();
  }
  if (config.type === 'assign') {
    const { scope, current } = context;
    let map: any = assignStream;
    let fill = false;
    const args = [build(queue, context, config.value)];
    if (config.key) {
      if (config.key.type === 'any') {
        fill = true;
        map = mapStream(maps[config.key.group ? 'fillGroup' : 'fill']);
      } else {
        args.push(build(queue, context, config.key));
      }
    }
    if (config.all) map = mapStream(maps.unpack);
    if (!fill) scope[0] = queue([scope[0], ...args], map);
    current[0] = queue([current[0], ...args], map);
    return queue([], () => ({ initial: { type: 'nil' } }));
  }
  if (config.type === 'map') {
    return queue(
      config.args.map(a => build(queue, context, a)),
      mapStream(maps[config.map]),
    );
  }
  if (config.type === 'merge') {
    return queue(
      config.args.map(a => build(queue, context, a)),
      ({ initial, output }) => {
        const pushes = initial.filter(i => i.push);
        return {
          initial: {
            ...initial[initial.length - 1],
            ...(pushes.length === 1 ? { push: pushes[0].push } : {}),
          },
          input: next => {
            const changed = next.filter(v => v.changed);
            output(changed[changed.length - 1]).value;
          },
        };
      },
    );
  }
  if (config.type === 'count') {
    return queue([build(queue, context, config.arg)], ({ output }) => {
      let count = 0;
      return { initial: toData(count), input: () => output(toData(++count)) };
    });
  }
  if (config.type === 'date') {
    return queue([build(queue, context, config.arg)], ({ initial, output }) => {
      let value = initial[0];
      const interval = setInterval(() => {
        output(toDateData(value));
      }, 1000);
      return {
        initial: toDateData(value),
        input: v => {
          if (!v) {
            clearInterval(interval);
          } else {
            value = v[0].value;
            output(toDateData(value));
          }
        },
      };
    });
  }
  if (['string', 'nil'].includes(config.type)) {
    return queue([], () => ({ initial: config }));
  }
  if (config.type === 'any') {
    return queue([], ({ output }) => ({
      initial: { type: 'nil', set: v => output(toData(v)) },
    }));
  }
  if (config.type === 'context') {
    return context.scope[0];
  }
};

export default (config, output) =>
  process({ initial: { type: 'nil' }, output }, queue =>
    build(queue, { scope: [0], current: [] }, config),
  ).initial;
