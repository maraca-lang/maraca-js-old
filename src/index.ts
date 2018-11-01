import build from './build';
import { compare } from './data';
import parse from './parse';
import process from './process';

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

export default (script, initial, output) => {
  output(
    prepareData(
      process(
        {
          values: [initial],
          output: (_, next) => output(prepareData(next)),
        },
        queue => [build(queue, { scope: [0], current: [0] }, parse(script))],
      ).initial[0],
    ),
  );
};
