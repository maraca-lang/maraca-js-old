import { fromValue, toValue } from './data';

export const toIndex = (v: string) => {
  const n = parseFloat(v);
  return !isNaN(v as any) && !isNaN(n) && n === Math.floor(n) && n > 0 && n;
};

export const simpleStream = (arg, func, deep) => ({ get, output }) => {
  let first = true;
  let initial = { type: 'nil' };
  const emit = data => {
    const value = toValue(data);
    if (first) initial = value;
    else output(value);
  };
  const update = func(emit);
  update(fromValue(get(arg, deep)));
  first = false;
  return {
    initial,
    update: () => update(fromValue(get(arg, deep))),
    stop: () => update(),
  };
};

export const sortMultiple = <T = any>(
  items1: T[],
  items2: T[],
  sortItems: (a: T, b: T) => number,
  reverseUndef = false,
) =>
  Array.from({ length: Math.max(items1.length, items2.length) }).reduce(
    (res, _, i) => {
      if (res !== 0) return res;
      if (items1[i] === undefined) return reverseUndef ? 1 : -1;
      if (items2[i] === undefined) return reverseUndef ? -1 : 1;
      return sortItems(items1[i], items2[i]);
    },
    0,
  ) as -1 | 0 | 1;
