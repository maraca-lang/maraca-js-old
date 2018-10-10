import { binary } from './core';
import { sortStrings, toData, toKey } from './data';

const sortTypes = ([v1, v2]: any) => {
  if (v2.type === 'nil') return [v1, v2];
  if (v1.type === 'nil') return [v2, v1];
  if (v2.type === 'string') return [v1, v2];
  if (v1.type === 'string') return [v2, v1];
  if (!v2.value.other) return [v1, v2];
  if (!v1.value.other) return [v2, v1];
  if (v2.value.otherType !== 'key') return [v1, v2];
  if (v1.value.otherType !== 'key') return [v2, v1];
  return [v1, v2];
};

const combineInfo = ([v1, v2, a1, a2]: any) => {
  const [big, small] = sortTypes([v1, v2]);
  const base = { reverse: big !== v1, values: [big, small, a1, a2] };
  if (small.type === 'table') return { type: 'multi', ...base };
  if (big.type === 'table') return { type: 'get', ...base };
  if (small.type === 'string') return { type: 'join', ...base };
  return { type: 'identity', ...base };
};

const tableGet = (data, key) => {
  const k = toKey(key);
  if (k === null) return { type: 'nil' };
  if (data.values[k]) return data.values[k];
  if (data.other) return data.other;
  return { type: 'nil' };
};

const run: any = (type, { initial, output }) => {
  if (type === 'identity') {
    return { initial: [toData(initial[0].value), initial[2], initial[3]] };
  }
  if (type === 'join') {
    return {
      initial: [
        {
          type: 'string',
          value: `${initial[0].value} ${initial[1].value}`,
        },
        initial[2],
        initial[3],
      ],
    };
  }
  if (type === 'get') {
    const value = tableGet(initial[0].value, initial[1]);
    if (typeof value !== 'function') {
      return { initial: [value, initial[2], initial[3]] };
    }
    if (initial[0].value.otherType !== 'key') {
      return { initial: [{ type: 'nil' }, initial[2], initial[3]] };
    }
    const result = value({
      initial: [initial[1], initial[2], initial[3]],
      output,
    });
    return {
      initial: result.initial,
      input: changes => {
        if (changes) {
          result.input(changes.map(c => [c[0] - 1, c[1], c[2]]));
        }
      },
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
      const big = tableGet(initial[0].value, k);
      const args = [
        initial[0].value.otherType === 'key'
          ? initial[1]
          : tableGet(initial[1].value, k),
        result,
        result,
      ];
      if (initial[0].value.otherType === 'keyValue') args.unshift(k);
      const res =
        typeof big === 'function'
          ? big({ initial: args })
          : combine({ initial: [big, ...args] } as any);
      res.input();
      result = res.initial[2];
      if (res.initial[0].type !== 'nil') {
        result = binary.assign([result, res.initial[0], k]);
      }
    }
    return { initial: [result, initial[2], initial[3]] };
  }
};

const canContinue = (next, prev, changes) => {
  if (next.type === prev.type && next.reverse === prev.reverse) {
    if (
      next.type === 'get' &&
      !changes.some(c => c[0] === 0) &&
      typeof tableGet(next.values[0].value, next.values[1]) === 'function'
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
          initial.forEach((v, i) => output(i, v));
          prev = next;
        }
      }
    },
  };
};

export default combine;
