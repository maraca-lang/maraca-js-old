import { toData, toTypedValue } from '../data';
import maraca from '../index';

const source = [`test? (@1)`, { test: '#size.[a, b, _, c, `hello`]' }];

const map = m => emit => value => emit(toData(m(value)));

const config = {
  '@': [
    emit => {
      let count = 0;
      let interval;
      return value => {
        if (interval) clearInterval(interval);
        if (value) {
          const inc = toTypedValue(value);
          if (inc.type === 'number') {
            emit(toData(count++));
            interval = setInterval(
              () => emit(toData(count++)),
              inc.value * 1000,
            );
          } else {
            emit(toData(null));
          }
        }
      };
    },
  ],
  '#': {
    size: toData(
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
