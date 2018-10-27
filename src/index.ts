import build from './build';
import { compare } from './data';
import parse from './parse';
import process from './process';

const orderData = ({ type, value, set }) => {
  if (type !== 'list') return { type, value, set };
  return {
    type,
    indices: value.indices.map(orderData),
    values: Object.keys(value.values)
      .sort((a, b) => compare(value.values[a].key, value.values[b].key))
      .map(k => ({
        key: orderData(value.values[k].key),
        value: orderData(value.values[k].value),
      })),
    set,
  };
};

export default (script, initial, output) => {
  output(
    orderData(
      process(
        {
          initial: [initial],
          output: (_, next) => output(orderData(next)),
        },
        queue => [build(queue, { scope: [0], current: [0] }, parse(script))],
      ).initial[0],
    ),
  );
};
