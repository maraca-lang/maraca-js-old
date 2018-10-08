import { sortStrings, stringToValue, tableGet, toData, toKey } from './data';
import maps from './maps';

const valueStream = build => ({ initial: [value, scope, current], output }) => {
  const { initial, input } = build({
    initial: value,
    output: value => output(0, value),
  });
  return {
    initial: [initial, scope, current],
    input: updates => {
      updates.forEach(([i, v, c]) => {
        if (i === 0) input(v, c);
        else output(i, v, c);
      });
    },
  };
};

const valueMap = map =>
  valueStream(({ initial, output }) => ({
    initial: map(initial, true),
    input: (value, changed) => {
      const result = map(value, changed);
      if (result) output(result);
    },
  }));

const toFunc = func => {
  if (func.type === 'function') return func.value;
  if (func.type === 'table') {
    return valueMap(value => {
      if (value.type !== 'nil' && value.type !== 'table') {
        return { type: 'nil' };
      }
      const keys = Array.from(
        new Set([
          ...Object.keys(func.value.values),
          ...Object.keys(value.value.values),
        ]),
      ).sort(sortStrings);
      let result = { type: 'nil' };
      for (const key of keys) {
        const k = toData(key);
        const keyValues = {
          func: tableGet(func.value, k),
          value: tableGet(value.value, k),
        };
        const f = toFunc(keyValues.func);
        const res = f({ initial: [keyValues.value, result, result] }).initial;
        result = res[2];
        if (res[0].type !== 'nil') result = maps.assign([result, res[0], k]);
      }
      return result;
    });
  }
  return valueMap((value, changed) => {
    if (value.type === 'table') {
      const k = toKey(func, value.value);
      return (changed === true || changed[k]) && tableGet(value.value, func);
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
  });
};

export default toFunc;
