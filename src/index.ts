import build from './build';
import { toData } from './data';
import parse from './parse';
import process from './process';

export { compare, toData, toTypedValue } from './data';
export { default as parse } from './parse';

export const createMethod = (map, deep = false) => () => ({
  initial: {
    type: 'list',
    value: {
      indices: [],
      values: {},
      other: (create, value) => [
        create(({ get, output }) => {
          const { initial, update } = map({
            initial: get(value, deep),
            output: value => output(value),
          });
          return { initial, update: () => update(get(value, deep)) };
        }),
      ],
    },
  },
});

export default (config, code, output) => {
  const create = process();
  const modules = typeof code === 'string' ? { start: code } : code;
  const parsed = Object.keys(modules).reduce(
    (res, k) => ({ ...res, [k]: parse(modules[k]) }),
    {} as any,
  );
  const scope = {
    type: 'list',
    value: {
      indices: [],
      values: Object.keys(modules).reduce(
        (res, k) => ({
          ...res,
          [k]: {
            key: toData(k),
            value: create(({ create }) => ({
              initial: build(
                config,
                create,
                {
                  scope: [scope],
                  current: [
                    { type: 'list', value: { indices: [], values: {} } },
                  ],
                },
                parse(modules[k]),
              ),
            })),
          },
        }),
        {},
      ),
    },
  };
  const stream = build(
    config,
    create,
    {
      scope: [scope],
      current: [{ type: 'list', value: { indices: [], values: {} } }],
    },
    parsed.start,
  );
  const result = create(
    ({ get, output }) => {
      const run = () => get(stream, true);
      return { initial: run(), update: () => output(run()) };
    },
    data => output(data),
  )!;
  const obj = {};
  result.value.observe(obj);
  const initial = result.value.value;
  const stop = () => result.value.unobserve(obj);
  if (!output) {
    stop();
    return initial;
  }
  output(initial);
  return stop;
};
