import { toData, toTypedValue } from '../data';
import maraca, { createMethod } from '../index';

const source = {
  modules: {
    index: `test? (@1000)`,
    test: '#size [a, b, c]',
  },
  index: 'index',
};

const map = m => ({ initial, output }) => ({
  initial: toData(m(initial)),
  update: value => output(toData(m(value))),
});

const config = create => ({
  dynamics: [
    arg => ({ get, output }) => {
      let interval;
      const run = () => {
        let count = 0;
        const inc = toTypedValue(get(arg));
        if (['integer', 'number'].includes(inc.type)) {
          interval = setInterval(() => output(toData(count++)), inc.value);
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
  library: {
    size: createMethod(
      create,
      map(x =>
        x.type === 'list'
          ? x.value.indices.filter(x => x).length +
            Object.keys(x.value.values).length
          : '0',
      ),
    ),
  },
});

maraca(config, source, data => console.log(JSON.stringify(data, null, 2)));
