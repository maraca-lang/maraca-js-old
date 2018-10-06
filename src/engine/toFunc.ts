import { stringToValue, tableGet, toData } from './data';
import maps from './maps';

const toFunc = func => {
  if (func.type === 'function') return func.value;
  if (func.type === 'table') {
    return ({ initial, output }) => {
      let result = { type: 'nil' };
      let updaters = {};
      const update = value => {
        if (!value) {
          for (const key of Object.keys(updaters)) {
            updaters[key]();
          }
          return false;
        }
        let doEmit = false;
        const updateKey = (k, v) => {
          result = maps.assign([result, k, v]);
          doEmit = true;
        };
        if (value.type !== 'nil' && value.type !== 'table') {
          result = { type: 'nil' };
          updaters = {};
        } else {
          const keys = Array.from(
            new Set([
              ...Object.keys(func.value.values),
              ...Object.keys(value.value.values),
            ]),
          );
          for (const key of keys) {
            const k = toData(key);
            const keyValues = {
              func: tableGet(func.value, k),
              value: tableGet(value.value, k),
            };
            if (updaters[key]) {
              updaters[key](keyValues.value);
            } else {
              const f = toFunc(keyValues.func);
              const { value: res, update } = f(keyValues.value, v =>
                updateKey(k, v),
              );
              updateKey(k, res);
              updaters[key] = update;
            }
          }
          for (const key of Object.keys(updaters).filter(
            k => !keys.includes(k),
          )) {
            updaters[key]();
            delete updaters[key];
            updateKey(toData(key), { type: 'nil' });
          }
        }
        return doEmit;
      };
      update(initial);
      return { initial: result, input: v => update(v) && output(result) };
    };
  }
  return ({ initial, output }) => {
    const map = value => {
      if (func.type === 'nil' || func.type === 'string') {
        if (value.type === 'table') {
          return tableGet(value.value, func);
        }
        if (func.type === 'nil' || value.type === 'nil') {
          return { type: 'nil' };
        }
        if (func.type === 'string' && value.type === 'string') {
          if (func.value === '-') {
            const v = stringToValue(value.value);
            if (typeof v === 'string') return { type: 'nil' };
            return { type: 'string', value: `${-v}` };
          }
          return { type: 'string', value: `${func.value} ${value.value}` };
        }
        return { type: 'nil' };
      }
    };
    return { initial: map(initial), input: v => v && output(map(v)) };
  };
};

export default toFunc;
