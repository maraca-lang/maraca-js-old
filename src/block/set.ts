import { print, resolve } from '../index';
import {
  compare,
  createBlock,
  fromJs,
  isResolved,
  keysToObject,
  printValue,
  resolveType,
  toIndex,
} from '../utils';

export const staticAppend = (block, value) => {
  if (!value.value) return block;
  return {
    ...block,
    indices: [...block.indices, value],
    ...(block.unresolved || !isResolved(value) ? { unresolved: true } : {}),
  };
};

export const staticSet = (block, value, key) => {
  const result = { ...block };
  if (!key) {
    if (isResolved(value)) {
      if (value.type === 'value') {
        result.values = {
          ...result.values,
          ['']: { key: { type: 'value', value: '' }, value },
        };
        return result;
      }
      result.values = { ...result.values, ...value.value.values };
      result.indices = [...result.indices, ...value.value.indices];
      return result;
    }
    result.streams = [...block.streams, { value }];
    result.indices = [...block.indices, { type: 'unpack', value }];
    result.unresolved = true;
    return result;
  }
  if (key.type === 'value') {
    result.values = {
      ...block.values,
      [printValue(key.value)]: { key, value },
    };
    if (!isResolved(value)) result.unresolved = true;
    return result;
  }
  result.streams = [...block.streams, { key, value }];
  result.unresolved = true;
  return result;
};

const extract = (block, keys, get) => {
  const rest = createBlock();
  rest.values = { ...block.values };
  rest.indices = block.indices
    .map((x) => resolveType(x, get))
    .filter((x) => x.value);
  let maxIndex = 0;
  const values = keys.map((key) => {
    const k = print(key, get);
    const i = toIndex(k);
    if (i) {
      maxIndex = i;
      return rest.indices[i - 1] || { type: 'value', value: '' };
    }
    const v = (rest.values[k] && rest.values[k].value) || {
      type: 'value',
      value: '',
    };
    delete rest.values[k];
    return v;
  });
  rest.indices = rest.indices.slice(maxIndex);
  return { values, rest };
};

export const resolveSets = (pairs, get) =>
  pairs.reduce((res, { key: k, value: v }) => {
    if (!k) {
      const value = resolveType(v, get);
      if (value.type === 'value') {
        return { ...res, ['']: { key: { type: 'value', value: '' }, value } };
      }
      return {
        ...res,
        ...value.value.values,
        ...resolveSets(value.value.streams, get),
      };
    }
    const key = resolve(k, get);
    if (key.type === 'block') {
      const value = resolveType(v, get);
      if (value.type === 'block') {
        const keyPairs = toPairs(key.value, get);
        const func = key.value.func;
        const funcDefault = typeof func === 'object' && func;
        const { values, rest } = extract(
          value.value,
          keyPairs.map((d) => d.key),
          get,
        );
        const result = {
          ...res,
          ...resolveSets(
            values.map((v, i) => ({ key: keyPairs[i].value, value: v })),
            get,
          ),
        };
        if (!funcDefault) return result;
        return {
          ...result,
          [print(funcDefault, get)]: {
            key: funcDefault,
            value: { type: 'block', value: rest },
          },
        };
      }
    }
    return { ...res, [print(key, get)]: { key, value: v } };
  }, {});

export const resolveIndices = (indices, get) =>
  indices.reduce((res, x) => {
    if (x.type !== 'unpack') return [...res, x];
    const value = resolveType(x.value, get);
    return value.type === 'block'
      ? [...res, ...resolveIndices(value.value.indices, get)]
      : res;
  }, []);

export const mapBlock = (block, map, get) => {
  let result = createBlock();
  const values = { ...block.values, ...resolveSets(block.streams, get) };
  result.values = keysToObject(Object.keys(values), (k) => ({
    key: values[k].key,
    value: map(values[k].value),
  }));
  result.indices = resolveIndices(block.indices, get)
    .map((x) => map(x))
    .filter((x) => x.value);
  if (
    Object.keys(result.values).some(
      (k) => !isResolved(result.values[k].value),
    ) ||
    result.indices.some((d) => !isResolved(d))
  ) {
    result.unresolved = true;
  }
  return result;
};

export const resolveDeep = (block, get) => {
  const result = mapBlock(block, (x) => resolve(x, get), get);
  if (typeof block.func === 'object') {
    return { ...result, func: resolve(block.func, get) };
  }
  return result;
};

export const toPairs = (block, get) => {
  const values = { ...block.values, ...resolveSets(block.streams, get) };
  const valuesPairs = Object.keys(values)
    .map((k) => values[k])
    .sort((a, b) => compare(a.key, b.key));
  const indices = resolveIndices(block.indices, get);
  const indicesPairs = indices.map((value, i) => ({
    key: fromJs(i + 1),
    value: value,
  }));
  if (valuesPairs[0] && !valuesPairs[0].key.value) {
    return [valuesPairs[0], ...indicesPairs, ...valuesPairs.slice(1)];
  }
  return [...indicesPairs, ...valuesPairs];
};

export const printBlock = (block, get) => {
  return `[${toPairs(block, get)
    .filter((x) => x.value.value)
    .map(({ key, value }) => {
      if (toIndex(key.value)) return print(value, get);
      const [k, v] = [print(key, get), print(value, get)];
      if (!k && value.type === 'block') return `'': ${v}`;
      if (key.type === 'value' || value.type === 'value') return `${k}: ${v}`;
      return `[=> ${k}]: ${v}`;
    })
    .join(', ')}]`;
};
