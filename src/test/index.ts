import maraca, { createMethod } from '../index';

const source = {
  modules: {
    index: `test? (@now)`,
    test: '#size [a, b, c]',
  },
  index: 'index',
};

const methods = {
  size: create =>
    createMethod(create, x => {
      return x.type === 'list'
        ? x.value.indices.filter(x => x).length +
            Object.keys(x.value.values).length
        : '0';
    }),
};

maraca(source, methods, data => console.log(JSON.stringify(data, null, 2)));
