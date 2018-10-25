import { binary } from './core';
import { compare } from './data';

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
  if (small.type === 'list') {
    return {
      type: ['=>', 'k=>'].includes(big.value.otherType) ? 'get' : 'multi',
      ...base,
    };
  }
  if (big.type === 'list') return { type: 'get', ...base };
  if (small.type === 'string') return { type: 'join', ...base };
  return { type: 'nil', ...base };
};

const listGet = (data, key) => {
  const v = data.values.find(x => compare(x.key, key) === 0);
  if (v) return v.value;
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
    const result = value({
      initial: args,
      output: (i, v) => {
        if (i === 1) output(0, v);
      },
    });
    return {
      initial: [result.initial[1]],
    };
  }
  if (type === 'multi') {
    const values1 = initial[0].value.values;
    const values2 = initial[1].value.values;
    const keys = [
      ...values1.map(x => x.key),
      ...values2
        .map(x => x.key)
        .filter(k => !values1.find(x => compare(k, x.key) === 0)),
    ].sort(compare);

    const inputs = [] as any;
    const values = [] as any;
    const runMulti = first => {
      for (let i = first; i < keys.length; i++) {
        if (inputs[i]) {
          inputs[i]();
          inputs[i] = null;
        }
        const prev = values[i - 1] ? values[i - 1].combined : { type: 'nil' };
        const big = listGet(initial[0].value, keys[i]);
        const small = listGet(initial[1].value, keys[i]);
        if (typeof big === 'function') {
          const args = [prev];
          if (initial[0].value.otherType === 'k=>v=>') {
            args.push(keys[i], small);
          }
          if (initial[0].value.otherType === 'v=>>') args.push(small);
          if (initial[0].value.otherType === 'k=>') args.push(initial[1]);
          const res = big({
            initial: args,
            output: (index, value) => {
              if (index === 0) values[i].result = value;
              else values[i].value = value;
              values[i].combined =
                values[i].value.type === 'nil'
                  ? values[i].result
                  : binary.assign([values[i].result, values[i].value, keys[i]]);
              output(0, runMulti(i + 1));
            },
          });
          inputs[i] = res.input;
          values[i] = {
            result: res.initial[0],
            value: res.initial[1],
            combined:
              res.initial[1].type === 'nil'
                ? res.initial[0]
                : binary.assign([res.initial[0], res.initial[1], keys[i]]),
          };
        } else {
          const res = combine({
            initial: [big, small],
            output: (_, value) => {
              values[i].value = value;
              values[i].combined = binary.assign([
                values[i].result,
                values[i].value,
                keys[i],
              ]);
              output(0, runMulti(i + 1));
            },
          } as any);
          inputs[i] = res.input;
          values[i] = {
            result: prev,
            value: res.initial[0],
            combined: binary.assign([prev, res.initial[0], keys[i]]),
          };
        }
      }
      return values[keys.length - 1].combined;
    };
    return { initial: [runMulti(0)] };
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
