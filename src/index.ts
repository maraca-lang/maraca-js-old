import build from './build';
import { toData } from './data';
import parse from './parse';
import process, { createIndexer } from './process';
// import { streamMap } from './core';

export { toData, toTypedValue } from './data';
export { default as parse } from './parse';

export const createMethod = (create, map, deep = false) => ({
  type: 'list',
  value: {
    indices: [],
    values: {},
    other: (index, value) => [
      create(createIndexer(index)(), ({ get, output }) => {
        const { initial, update } = map({
          initial: get(value, deep),
          output: value => output(value),
        });
        return { initial, update: () => update(get(value, deep)) };
      }),
    ],
  },
});

export default (config, code, output) => {
  const create = process();
  const indexer = createIndexer();
  const createdConfig = config(create, indexer);
  const modules = typeof code === 'string' ? { start: code } : code;
  const parsed = Object.keys(modules).reduce(
    (res, k) => ({ ...res, [k]: parse(modules[k]) }),
    {} as any,
  );
  const scope = {
    type: 'list',
    value: {
      indices: [],
      values: Object.keys(modules).reduce((res, k) => {
        const index = indexer();
        const subIndexer = createIndexer(index);
        return {
          ...res,
          [k]: {
            key: toData(k),
            value: create(index, () => ({
              initial: build(
                createdConfig,
                create,
                subIndexer,
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
        };
      }, {}),
    },
  };
  const stream = build(
    createdConfig,
    create,
    indexer,
    {
      scope: [scope],
      current: [{ type: 'list', value: { indices: [], values: {} } }],
    },
    parsed.start,
  );
  const result = create(
    indexer(),
    ({ get, output }) => {
      const run = () => get(stream, true);
      return { initial: run(), update: () => output(run()) };
    },
    data => output(data),
  );
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
