import build from './build';
import parse from './parse';
import process from './process';

import { sortStrings, stringToValue } from './data';

const numericIfIndex = k => {
  const v = stringToValue(k);
  if (typeof v === 'number' && Math.floor(v) === v) return v;
  return k;
};

const diff = (prev, next) => {
  if (
    prev.type !== 'nil' &&
    (prev.type === 'list') !== (next.type === 'list')
  ) {
    return diff({ type: 'nil' }, next);
  }
  if (next.type !== 'list') {
    if (next.value === prev.value && next.set === prev.set) return undefined;
    return {
      value: next.value || null,
      ...(next.set ? { set: next.set } : {}),
    };
  }
  const p = prev.type === 'list' ? prev.value.values : {};
  const n = next.value.values;
  const pKeys = Object.keys(p).map(numericIfIndex);
  const nKeys = Object.keys(n).map(numericIfIndex);
  const result = Array.from(new Set([...pKeys, ...nKeys]))
    .sort((a, b) => sortStrings(`${a}`, `${b}`))
    .map(key => {
      if (n[key] === undefined) return { key, value: { value: null } };
      const prevKey = pKeys.find(k => (p[k].id || k) === (n[key].id || key));
      const prevValue = (p && prevKey !== undefined && p[prevKey]) || {
        type: 'nil',
      };
      const d = diff(prevValue, n[key]);
      if (prevValue.type === 'nil' || key === prevKey) {
        return d === undefined ? undefined : { key, value: d };
      }
      return { key, value: d, ...(prevKey ? { prev: prevKey } : {}) };
    })
    .filter(x => x) as any[];
  return result.length === 0 ? undefined : result;
};

export default (script, initial, output) => {
  let prev = process(
    {
      initial: [initial],
      output: (_, next) => {
        const d = diff(prev, next);
        if (d) output(d);
        prev = next;
      },
    },
    queue => [build(queue, { scope: [0], current: [0] }, parse(script))],
  ).initial[0];
  output(diff({ type: 'nil' }, prev));
};
