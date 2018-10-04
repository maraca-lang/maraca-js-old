import { maps, toFunc } from './core';
import { toData } from './data';

const create = (context, indices, build) => {
  const index = context.steps.length;
  const result = {
    args: indices,
    ...build(indices.map(i => context.steps[i].value), v => {
      result.value = v;
      context.emit(index);
    }),
    listeners: [],
  };
  context.steps.push(result);
  indices.forEach(i => context.steps[i].listeners.push(index));
  return index;
};

export default {
  create,
  constant: (context, value) => create(context, [], () => ({ value })),
  apply: (context, indices) =>
    create(context, indices, ([func, arg], emit) => {
      let { value, update } = toFunc(func)(arg, emit);
      return {
        value,
        update: ([f, a]) => {
          if (f.changed) {
            update();
            ({ value, update } = toFunc(f.value)(a.value, emit));
            emit(value);
          } else {
            update(a.value);
          }
        },
      };
    }),
  merge: (context, indices) =>
    create(context, indices, (initial, emit) => {
      const pushes = initial.filter(i => i.push);
      return {
        value: {
          ...initial[initial.length - 1],
          ...(pushes.length === 1 ? { push: pushes[0].push } : {}),
        },
        update: values => {
          const changed = values.filter(v => v.changed);
          emit(changed[changed.length - 1]);
        },
      };
    }),
  map: (context, map, indices) =>
    create(context, indices, (initial, emit) => ({
      value: maps[map](initial),
      update: args => emit(maps[map](args.map(a => a.value))),
    })),
  variable: context =>
    create(context, [], (_, emit) => ({
      value: { type: 'nil', push: value => emit(toData(value)) },
    })),
};
