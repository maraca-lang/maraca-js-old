import { print, resolve } from '../index';
import { compare, fromJs, toNumber } from '../utils';

const dataMap = (map, deep?) => (args, get) =>
  fromJs(map(args.map((a, i) => resolve(a, get, deep && deep[i]))));

const numericMap = (map) =>
  dataMap((args) => {
    const values = args.map((a) => toNumber(a.value));
    if (values.some((v) => v === null)) return null;
    return map(values);
  });

export default {
  '=': ([s1, s2], get) => {
    const [t1, t2] = [resolve(s1, get, false), resolve(s2, get, false)];
    if (t1.type !== t2.type) return fromJs(false);
    if (t1.type === 'value') return fromJs(t1.value === t2.value);
    return fromJs(print(t1, get) === print(t2, get));
  },
  '!': dataMap(([a, b]) => {
    if (!b) return !a.value;
    return a.type !== b.type || a.value !== b.value;
  }),
  '<': dataMap(([a, b]) => compare(a, b) === -1, [true, true]),
  '>': dataMap(([a, b]) => compare(a, b) === 1, [true, true]),
  '<=': dataMap(([a, b]) => compare(a, b) !== 1, [true, true]),
  '>=': dataMap(([a, b]) => compare(a, b) !== -1, [true, true]),
  '+': numericMap(([a, b]) => a + b),
  '-': dataMap(([a, b]) => {
    if (!b) return a.type === 'value' ? `-${a.value}` : null;
    const [x, y] = [toNumber(a.value), toNumber(b.value)];
    return x !== null && y !== null ? x - y : null;
  }),
  '*': numericMap(([a, b]) => a * b),
  '/': numericMap(([a, b]) => a / b),
  '%': numericMap(([a, b]) => ((((a - 1) % b) + b) % b) + 1),
  '^': numericMap(([a, b]) => a ** b),
};
