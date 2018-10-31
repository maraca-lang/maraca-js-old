import { compare, resolveDeep, toData, toKey } from './data';

const sortTypes = (v1, v2) => {
  if (v2.type === 'nil') return [v1, v2];
  if (v1.type === 'nil') return [v2, v1];
  if (v2.type === 'value') return [v1, v2];
  if (v1.type === 'value') return [v2, v1];
  if (!v2.value.other) return [v1, v2];
  if (!v1.value.other) return [v2, v1];
  if (!['=>', 'k=>'].includes(v2.value.otherType)) return [v1, v2];
  if (!['=>', 'k=>'].includes(v1.value.otherType)) return [v2, v1];
  return [v1, v2];
};

const getType = (big, small) => {
  if (small.type === 'list') {
    return ['=>', 'k=>'].includes(big.value.otherType) ? 'get' : 'multi';
  }
  if (big.type === 'list') return 'get';
  if (small.type === 'value') return 'join';
  return 'nil';
};

const listGet = (data, key) => {
  const k = toKey(key);
  const v =
    typeof k === 'number'
      ? data.indices[k]
      : data.values[k] && data.values[k].value;
  return v || data.other || { type: 'nil' };
};

const listOrNull = list => {
  if (
    list.indices.length + Object.keys(list.values).length === 0 &&
    !list.other
  ) {
    return { type: 'nil' };
  }
  return { type: 'list', value: list };
};
const assign = (list = { indices: [], values: {} } as any, value, key) => {
  if (!key) {
    if (value.type === 'nil') return list;
    return listOrNull({ ...list, indices: [...list.indices, value] });
  }
  const k = toKey(key);
  if (typeof k === 'number') {
    const indices = [...list.indices];
    if (value.type === 'nil') delete indices[k];
    else indices[k] = value;
    return listOrNull({ ...list, indices });
  }
  return listOrNull({
    ...list,
    values: { ...list.values, [k]: { key, value } },
  });
};

const run = (v1, v2, get, output) => {
  const [big, small] = sortTypes(v1, v2);
  const reverse = big !== v1;
  const type = getType(big, small);
  if (type === 'nil') {
    return { initial: { type: 'nil' } };
  }
  if (type === 'join') {
    return { initial: { type: 'value', value: `${big.value} ${small.value}` } };
  }
  if (type === 'get') {
    const value = listGet(big.value, small);
    if (typeof value !== 'function') {
      return { initial: value };
    }
    if (!['=>', 'k=>'].includes(big.value.otherType)) {
      return { initial: { type: 'nil' } };
    }
    const args = [{ type: 'nil' }];
    if (big.value.otherType === 'k=>') args.push(small);
    const result = value(args.map(a => resolveDeep(a, get)), (i, v) => {
      if (i === 1) output(v);
    });
    return {
      initial: result.initial[1],
      stop: result.stop,
    };
  }
  const keys = [
    ...Array.from({
      length: Math.max(big.value.indices.length, small.value.indices.length),
    }).map((_, i) => i),
    ...Array.from(
      new Set([
        ...Object.keys(big.value.values),
        ...Object.keys(small.value.values),
      ]),
    ).sort((a, b) =>
      compare(
        (big.value.values[a] || small.value.values[a]).key,
        (big.value.values[b] || small.value.values[b]).key,
      ),
    ),
  ];
  const stops = [] as any;
  const values = [] as any;
  const runMulti = first => {
    for (let i = first; i < keys.length; i++) {
      if (stops[i]) stops[i]();
      const k =
        typeof keys[i] === 'number'
          ? toData((keys[i] as number) + 1)
          : (big.value.values[keys[i]] || small.value.values[keys[i]]).key;
      const prev = values[i - 1] ? values[i - 1].combined : { type: 'nil' };
      const bigValue = listGet(big.value, k);
      const smallValue = listGet(small.value, k);
      if (typeof bigValue === 'function') {
        const args = [prev];
        if (big.value.otherType === 'k=>v=>') args.push(k, smallValue);
        if (big.value.otherType === 'v=>>') args.push(smallValue);
        if (big.value.otherType === 'k=>') args.push(k);

        const { initial, stop } = bigValue(
          args.map(a => resolveDeep(a, get)),
          (i, v) => {
            if (i === 0) values[i].result = v;
            else values[i].value = v;
            values[i].combined =
              values[i].value.type === 'nil'
                ? values[i].result
                : assign(values[i].result.value, values[i].value, k);
            output(runMulti(i + 1));
          },
        );
        stops[i] = stop;
        values[i] = {
          result: initial[0],
          value: initial[1],
          combined:
            initial[1].type === 'nil'
              ? initial[0]
              : assign(initial[0].value, initial[1], k),
        };
      } else {
        const { initial, stop } = (combine as any)(
          ...(reverse ? [smallValue, bigValue] : [bigValue, smallValue]),
          get,
          value => {
            values[i].value = value;
            values[i].combined = assign(
              values[i].result.value,
              values[i].value,
              k,
            );
            output(runMulti(i + 1));
          },
        );
        stops[i] = stop;
        values[i] = {
          result: prev,
          value: initial,
          combined: assign(prev.value, initial, k),
        };
      }
    }
    return values[keys.length - 1].combined;
  };
  return {
    initial: runMulti(0),
    stop: () => {
      stops.forEach(s => s());
    },
  };
};

const combine = (s1, s2, get, output) => {
  let { initial, stop } = run(s1, s2, get, output);
  return {
    initial,
    input: (s1, s2) => {
      if (stop) stop();
      ({ initial, stop } = run(s1, s2, get, output));
      output(initial);
    },
    stop: () => {
      if (stop) stop();
    },
  };
};

export default combine;
