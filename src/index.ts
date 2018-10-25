import build from './build';
import parse from './parse';
import process from './process';

import { compare, toJs } from './data';

const diff = (prev, next) => {
  if (
    prev.type !== 'nil' &&
    (prev.type === 'list') !== (next.type === 'list')
  ) {
    return diff({ type: 'nil' }, next);
  }
  if (next.type !== 'list') {
    if (next.value === prev.value && next.set === prev.set) return undefined;
    return { value: toJs(next), ...(next.set ? { set: next.set } : {}) };
  }
  const p = prev.type === 'list' ? prev.value.values : [];
  const n = next.value.values;
  const result = [
    ...p.map(x => x.key),
    ...n.map(x => x.key).filter(k => !p.find(x => compare(k, x.key) === 0)),
  ]
    .sort(compare)
    .map(key => {
      const nValue = n.find(x => compare(key, x.key) === 0);
      if (!nValue) return { key: toJs(key), value: null };
      const pValue = p.find(
        x => compare(x.id || x.key, nValue.id || key) === 0,
      );
      const d = diff(pValue ? pValue.value : { type: 'nil' }, nValue.value);
      const res = { key: toJs(key) } as any;
      if (Array.isArray(d)) res.value = d;
      else if (d) Object.assign(res, d);
      if (!pValue || compare(pValue.key, key) === 0) {
        if (res.value === undefined) return undefined;
      } else {
        if (pValue) res.prev = pValue.value;
      }
      return res;
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
