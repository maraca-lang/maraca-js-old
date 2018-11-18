import build from './build';
import { compare, resolve, setOther, toData } from './data';
import parse from './parse';
import { createIndexer, createProcess, watchStreams } from './process';
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
    other: (index, [list, v], output) => {
      const subIndexer = createIndexer(index);
      const subContext = { scope: [{ type: 'nil' }], current: [list] };
      const result = streamMap(x => toData(map(x)), deep)(
        create,
        subIndexer(),
        [v],
      );
      return watchStreams(
        create,
        subIndexer,
        [subContext.current[0], result],
        output,
      );
    },
    otherType: 'k=>',
  },
});

export default (source, methods, output) => {
  const create = createProcess();
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
    (index, [list, v], output, get) => {
      const value = resolve(v, get);
      const subIndexer = createIndexer(index);
      const subContext = { scope: [{ type: 'nil' }], current: [list] };
      const result = build(
        methods,
        create,
        subIndexer,
        subContext,
        value.type === 'value' ? parsed[value.value] : { type: 'nil' },
      );
      return watchStreams(
        create,
        subIndexer,
        [subContext.current[0], result],
        output,
      );
    },
    'k=>',
  );
  output(
    prepareData(
      watchStreams(
        create,
        indexer,
        [
          build(
            methods,
            create,
            indexer,
            { scope: [scope], current: [{ type: 'nil' }] },
            parsed[index],
          ),
        ],
        (_, next) => output(prepareData(next)),
      ).initial[0],
    ),
  );
};
