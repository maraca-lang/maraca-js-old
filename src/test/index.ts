import { toData, toTypedValue } from '../data';
import maraca, { createMethod } from '../index';

const source = {
  start: `test? (@1)`,
  test: '#size.[a, b, _, c, `hello`]',
};

const map = m => ({ initial, output }) => ({
  initial: toData(m(initial)),
  update: value => output(toData(m(value))),
});

const config = {
  '@': [
    arg => ({ get, output }) => {
      let interval;
      const run = () => {
        let count = 0;
        const inc = toTypedValue(get(arg));
        if (inc.type === 'number') {
          interval = setInterval(
            () => output(toData(count++)),
            inc.value * 1000,
          );
          return toData(count++);
        }
        return toData(null);
      };
      return {
        initial: run(),
        update: () => {
          clearInterval(interval);
          output(run());
        },
        stop: () => clearInterval(interval),
      };
    },
  ],
  '#': {
    size: createMethod(
      map(x =>
        x.type === 'list'
          ? x.value.indices.filter(x => x).length +
            Object.keys(x.value.values).filter(
              k => x.value.values[k].value.type !== 'nil',
            ).length
          : '0',
      ),
    ),
  },
};

maraca(config, source, data => console.log(JSON.stringify(data, null, 2)));
