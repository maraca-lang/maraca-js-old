import { maps } from './core';
import stream from './stream';

const process = (context, config) => {
  if (Array.isArray(config)) {
    if (config[0].type === 'any') {
      return process(context, {
        type: 'assign',
        value: config[1],
        all: true,
      });
    }
    return stream.apply(context, config.map(c => process(context, c)));
  }
  if (config.type === 'function') {
    const map = ([scope, input]) => {
      return {
        type: 'function',
        value: (initial, emit) => {
          const assign = v => maps.assign([scope, input, v]);
          const { value, update } = run(config.output, assign(initial), emit);
          return { value, update: v => update(assign(v)) };
        },
      };
    };
    return stream.create(
      context,
      [context.scope[0], process(context, config.input)],
      (initial, emit) => ({
        value: map(initial),
        update: args => emit(map(args.map(a => a.value))),
      }),
    );
  }
  if (config.type === 'table') {
    const { scope, current } = context;
    scope.unshift(stream.map(context, 'clearIndices', [scope[0]]));
    current.unshift(stream.constant(context, { type: 'nil' }));
    config.values.forEach(v => process(context, v));
    scope.shift();
    return current.shift();
  }
  if (config.type === 'assign') {
    const { scope, current } = context;
    const value = process(context, config.value);
    if (config.key) {
      if (config.key.type === 'any') {
        const map = config.key.group ? 'fillGroup' : 'fill';
        current[0] = stream.map(context, map, [current[0], value]);
      } else {
        const key = process(context, config.key);
        scope[0] = stream.map(context, 'assign', [scope[0], key, value]);
        current[0] = stream.map(context, 'assign', [current[0], key, value]);
      }
    } else {
      const map = config.all ? 'merge' : 'append';
      scope[0] = stream.map(context, map, [scope[0], value]);
      current[0] = stream.map(context, map, [current[0], value]);
    }
    return stream.constant(context, { type: 'nil' });
  }
  if (config.type === 'map') {
    return stream.map(
      context,
      config.map,
      config.args.map(a => process(context, a)),
    );
  }
  if (config.type === 'merge') {
    return stream.merge(context, config.args.map(a => process(context, a)));
  }
  if (['count', 'date', 'string', 'nil'].includes(config.type)) {
    return stream.constant(context, config);
  }
  if (config.type === 'any') {
    return stream.variable(context);
  }
  if (config.type === 'context') {
    return context.scope[0];
  }
};

const run = (config, initial, emit) => {
  let active = { changed: {}, queue: [] } as any;
  const context = {
    steps: [],
    scope: [],
    current: [],
    emit: index => {
      active.changed[index] = true;
      context.steps[index].listeners.forEach(i => {
        if (!active.queue.includes(i)) {
          active.queue.push(i);
          active.queue.sort((a, b) => a - b);
        }
      });
      if (active.queue.length > 0) {
        const next = active.queue.shift();
        context.steps[next].update(
          context.steps[next].args.map(i => ({
            value: context.steps[i].value,
            changed: active.changed[i],
          })),
        );
      } else {
        active = { changed: {}, queue: [] };
        if (index === result) emit(context.steps[index].value);
      }
    },
  } as any;
  context.scope.unshift(stream.constant(context, initial));
  const result = process(context, config);
  return {
    value: context.steps[result].value,
    update: value => {
      context.steps[0].value = value;
      context.emit(0);
    },
  };
};

export default (config, emit) => run(config, { type: 'nil' }, emit).value;
