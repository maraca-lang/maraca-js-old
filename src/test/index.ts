import { fromJs, toJs } from '../data';
import maraca from '../index';
import { Source } from '../typings';

const source = ['test? (@1)', { test: '#[a, b, _, c, `hello`]' }] as Source;

const config = {
  '@': [
    emit => {
      let count = 0;
      let interval;
      return value => {
        if (interval) clearInterval(interval);
        if (value) {
          const inc = toJs(value);
          if (typeof inc === 'number') {
            emit(fromJs(count++));
            interval = setInterval(() => emit(fromJs(count++)), inc * 1000);
          } else {
            emit(fromJs(null));
          }
        }
      };
    },
  ],
  '#': {
    size: fromJs(emit => x =>
      emit(
        fromJs(
          x.type === 'list'
            ? x.value.filter(v => v.value.type !== 'nil').length
            : '0',
        ),
      ),
    ),
  },
};

maraca(source, config, data => console.log(JSON.stringify(data, null, 2)));
