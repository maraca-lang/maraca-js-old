import { toData } from '../data';
import maraca, { createMethod } from '../index';

const source = {
  modules: {
    index: `test? (@now)`,
    test: '#size [a, b, c]',
  },
  index: 'index',
};

const map = m => ({ initial, output }) => ({
  initial: toData(m(initial)),
  update: value => output(toData(m(value))),
});

const methods = {
  size: create =>
    createMethod(
      create,
      map(x => {
        return x.type === 'list'
          ? x.value.indices.filter(x => x).length +
              Object.keys(x.value.values).length
          : '0';
      }),
    ),
};

maraca(source, methods, data => console.log(JSON.stringify(data, null, 2)));
