import build from './build';
import { compare, setOther } from './data';
import parse from './parse';
import process from './process';

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

export default (source, initial, methods, output) => {
  const { modules, index } =
    typeof source === 'string'
      ? { modules: { index: source }, index: 'index' }
      : source;
  const parsed = Object.keys(modules).reduce(
    (res, k) => ({ ...res, [k]: parse(modules[k]) }),
    {},
  );
  const other = ([result, value], output) =>
    process({ values: [result, { type: 'nil' }], output }, queue => {
      const ctx = { scope: [1], current: [0] };
      const result = build(
        methods,
        queue,
        ctx,
        value.type === 'value' ? parsed[value.value] : { type: 'nil' },
      );
      return [ctx.current[0], result];
    });
  output(
    prepareData(
      process(
        {
          values: [setOther(initial, other, 'k=>')],
          output: (_, next) => output(prepareData(next)),
        },
        queue => [
          build(methods, queue, { scope: [0], current: [0] }, parsed[index]),
        ],
      ).initial[0],
    ),
  );
};
