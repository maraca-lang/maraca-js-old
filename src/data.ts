import listUtils from './list';
import { Data } from './typings';
import { simpleStream } from './utils';

export const fromJs = (value: any): Data => {
  if (value === 0) return { type: 'value', value: '0' };
  if (!value) return { type: 'nil' };
  if (value === true) return { type: 'value', value: 'true' };
  if (typeof value === 'number') return { type: 'value', value: `${value}` };
  if (typeof value === 'string') return { type: 'value', value };
  if (typeof value === 'function') {
    return listUtils.fromFunc((create, arg) => [
      create(simpleStream(arg, value, true)),
    ]);
  }
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return { type: 'value', value: value.toISOString() };
  }
  if (
    Object.keys(value).length === 2 &&
    Object.keys(value)
      .sort()
      .join(',') === 'lat,lng'
  ) {
    return { type: 'value', value: JSON.stringify(value) };
  }
  if (Array.isArray(value)) {
    return listUtils.fromPairs(
      value.map((v, i) => ({ key: fromJs(i + 1), value: fromJs(v) })),
    );
  }
  return listUtils.fromPairs(
    Object.keys(value).map(k => ({ key: fromJs(k), value: fromJs(value[k]) })),
  );
};

const regexs = {
  time: /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)/,
  location: /{"lat":[0-9\.-]+,"lng":[0-9\.-]+}/,
};
export const toJs = (data: Data): any => {
  if (data.type === 'nil') return null;
  if (data.type === 'value') {
    const s = data.value;
    if (!isNaN(s as any) && !isNaN(parseFloat(s))) return parseFloat(s);
    if (regexs.time.test(s)) return new Date(s);
    if (regexs.location.test(s)) return JSON.parse(s);
    return s;
  }
  return listUtils
    .toPairs(data)
    .filter(({ value }) => value.type !== 'nil')
    .map(({ key, value }) => ({ key: toJs(key), value: toJs(value) }));
};

export const toValue = data => {
  if (data.type !== 'list') return data;
  return listUtils.fromData(data);
};
export const fromValue = value => {
  if (value.type !== 'list') return value;
  return listUtils.toData(value);
};

export const isEqual = (v1, v2) => {
  if (v1.type !== v2.type) return false;
  if (v1.type !== 'list') return v1.value === v2.value;
  const keys1 = Object.keys(v1.value.values);
  const keys2 = Object.keys(v2.value.values);
  if (keys1.length !== keys2.length) return false;
  return keys1.every(
    k =>
      v2.value.values[k] &&
      isEqual(v1.value.values[k].value, v2.value.values[k].value),
  );
};
