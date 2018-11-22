import build from './build';
import { compare, setOther } from './data';
import parse from './parse';
import process, { createIndexer } from './process';
import { streamMap } from './core';

export { toData, toTypedValue } from './data';
export { default as parse } from './parse';

const prepareData = ({ type, value, set, id }) => {
  const idValue = id && id.type === 'value' && id.value;
  if (type !== 'list') return { type, value, set, id: idValue };
  return {
    type,
    indices: value.indices.map((v, i) =>
      prepareData({ ...v, id: v.id || { type: 'value', value: `${i + 1}` } }),
    ),
    values: Object.keys(value.values)
      .sort((a, b) => compare(value.values[a].key, value.values[b].key))
      .map(k => ({
        key: prepareData(value.values[k].key),
        value: prepareData(value.values[k].value),
      })),
    set,
    id: idValue,
  };
};

export const createMethod = (create, map, deep = false) => ({
  type: 'list',
  value: {
    indices: [],
    values: {},
    other: (index, [list, v]) => {
      const subIndexer = createIndexer(index);
      const subContext = { scope: [{ type: 'nil' }], current: [list] };
      const result = create(subIndexer(), ({ get, output }) => {
        const { initial, update } = map({
          initial: get(v, deep),
          output: value => output(value),
        });
        return { initial, update: () => update(get(v, deep)) };
      });
      return [subContext.current[0], result];
    },
    otherType: 'k=>',
  },
});

export default (source, methods, output) => {
  const create = process();
  const indexer = createIndexer();
  const { modules, index } =
    typeof source === 'string'
      ? { modules: { index: source }, index: 'index' }
      : source;
  const parsed = Object.keys(modules).reduce(
    (res, k) => ({ ...res, [k]: parse(modules[k]) }),
    {},
  );
  const scope = setOther(
    { type: 'nil' },
    (index, [list, v]) => {
      const result = streamMap(value => {
        const subIndexer = createIndexer(index);
        return build(
          methods,
          create,
          subIndexer,
          { scope: [scope], current: [list] },
          (value.type === 'value' && parsed[value.value]) || { type: 'nil' },
        );
      })(create, index, [v]);
      return [{ type: 'nil' }, result];
    },
    'k=>',
  );
  const stream = build(
    methods,
    create,
    indexer,
    { scope: [scope], current: [{ type: 'nil' }] },
    parsed[index],
  );
  const result = create(
    indexer(),
    ({ get, output }) => {
      const run = () => get(stream, true);
      return { initial: run(), update: () => output(run()) };
    },
    data => output(prepareData(data)),
  );
  const obj = {};
  result.value.observe(obj);
  output(prepareData(result.value.value));
  return () => result.value.unobserve(obj);
};
