import { binary } from './core';
import { sortStrings, toData, toKey } from './data';

const sortTypes = ([v1, v2]: any) => {
  if (v2.type === 'nil') return [v1, v2];
  if (v1.type === 'nil') return [v2, v1];
  if (v2.type === 'string') return [v1, v2];
  if (v1.type === 'string') return [v2, v1];
  if (!v2.value.other) return [v1, v2];
  if (!v1.value.other) return [v2, v1];
  if (!['=>', 'k=>'].includes(v2.value.otherType)) return [v1, v2];
  if (!['=>', 'k=>'].includes(v1.value.otherType)) return [v2, v1];
  return [v1, v2];
};

const combineInfo = ([v1, v2]: any) => {
  const [big, small] = sortTypes([v1, v2]);
  const base = { reverse: big !== v1, values: [big, small] };
  if (small.type === 'list') return { type: 'multi', ...base };
  if (big.type === 'list') return { type: 'get', ...base };
  if (small.type === 'string') return { type: 'join', ...base };
  return { type: 'nil', ...base };
};

const listGet = (data, key) => {
  const k = toKey(key);
  if (k === null) return { type: 'nil' };
  if (data.values[k]) return data.values[k];
  if (data.other) return data.other;
  return { type: 'nil' };
};

const run: any = (type, { initial, output }) => {
  if (type === 'nil') {
    return { initial: [{ type: 'nil' }] };
  }
  if (type === 'join') {
    return {
      initial: [
        {
          type: 'string',
          value: `${initial[0].value} ${initial[1].value}`,
        },
      ],
    };
  }
  if (type === 'get') {
    const value = listGet(initial[0].value, initial[1]);
    if (typeof value !== 'function') {
      return { initial: [value] };
    }
    if (!['=>', 'k=>'].includes(initial[0].value.otherType)) {
      return { initial: [{ type: 'nil' }] };
    }
    const args = [{ type: 'nil' }];
    if (initial[0].value.otherType === 'k=>') args.push(initial[1]);
    const result = value({ initial: args, output });
    return {
      initial: [result.initial[1]],
      // input: changes => {
      //   if (changes) {
      //     result.input(changes.map(c => [c[0] - 1, c[1], c[2]]));
      //   }
      // },
    };
  }
  if (type === 'multi') {
    const keys = Array.from(
      new Set([
        ...Object.keys(initial[0].value.values),
        ...Object.keys(initial[1].value.values),
      ]),
    ).sort(sortStrings);
    let result = { type: 'nil' };
    for (const key of keys) {
      const k = toData(key);
      const big = listGet(initial[0].value, k);
      if (typeof big === 'function') {
        const args = [result];
        if (initial[0].value.otherType === 'k=>v=>') {
          args.push(k, listGet(initial[1].value, k));
        }
        if (initial[0].value.otherType === 'v=>>') {
          args.push(listGet(initial[1].value, k));
        }
        if (initial[0].value.otherType === 'k=>') {
          args.push(initial[1]);
        }
        const res = big({ initial: args });
        res.input();
        result = res.initial[0];
        if (res.initial[1].type !== 'nil') {
          result = binary.assign([result, res.initial[1], k]);
        }
      } else {
        const res = combine({
          initial: [big, listGet(initial[1].value, k)],
        } as any);
        res.input();
        result = binary.assign([result, res.initial[0], k]);
      }
    }
    return { initial: [result] };
  }
};

const canContinue = (next, prev, changes) => {
  if (next.type === prev.type && next.reverse === prev.reverse) {
    if (
      next.type === 'get' &&
      !changes.some(c => c[0] === 0) &&
      typeof listGet(next.values[0].value, next.values[1]) === 'function'
    ) {
      return true;
    }
  }
  return false;
};

const combine = ({ initial: first, output }) => {
  let base = first;
  let prev = combineInfo(base);
  let { initial, input } = run(prev.type, { initial: prev.values, output });
  return {
    initial,
    input: (updates?) => {
      if (updates) {
        let changes = [...updates];
        changes.forEach(c => (base[c[0]] = c[1]));
        let next = combineInfo(base);
        if (next.reverse) {
          changes.forEach(c => {
            if (c[0] < 2) c[0] = c[0] === 0 ? 1 : 0;
          });
        }
        if (input && canContinue(next, prev, changes)) {
          input(changes);
        } else {
          if (input) input();
          ({ initial, input } = run(next.type, {
            initial: next.values,
            output,
          }));
          output(0, initial[0]);
          prev = next;
        }
      }
    },
  };
};

export default combine;
