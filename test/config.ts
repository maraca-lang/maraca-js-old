import { fromJs, toJs } from '../src/index';

export default {
  '@': [
    emit => {
      let count = 1;
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
      x &&
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
