import {
  sortStrings,
  stringToValue,
  toData,
  toDateData,
  toKey,
  toNumber,
  toString,
} from './data';

const typeFunc = (toType, func) => ([a, b]) => {
  const v1 = toType(a);
  const v2 = toType(b);
  if (v1 === null || v2 === null) return { type: 'nil' };
  return toData(func(v1, v2));
};

const tableGet = (data, key) => {
  const k = toKey(key, data.indices);
  return k === null
    ? { type: 'nil' }
    : data.values[k] || data.fill.value || { type: 'nil' };
};

const tableFunc = func => ([data, ...args]) => {
  if (data.type !== 'nil' && data.type !== 'table') return { type: 'nil' };
  const result = func(data.value || { values: {}, indices: [] }, ...args);
  if (Object.keys(result.values).length === 0 && !result.fill) {
    return { type: 'nil' };
  }
  return { type: 'table', value: result };
};

export const maps = {
  clearIndices: tableFunc(table => {
    const result = { ...table, values: { ...table.values } };
    result.indices.forEach(i => delete result[i]);
    result.indices = [];
    return result;
  }),
  append: tableFunc((table, value) => {
    if (value.type === 'nil') return table;
    const k = (table.indices[table.indices.length - 1] || 0) + 1;
    return {
      ...table,
      values: { ...table.values, [k]: value },
      indices: [...table.indices, k],
    };
  }),
  assign: tableFunc((table, key, value) => {
    const k = toKey(key, table.indices);
    if (k === null) return table;
    if (value.type === 'nil') {
      const result = { ...table, values: { ...table.values } };
      delete result.values[k];
      if (typeof k === 'number') {
        const i = result.indices.indexOf(k);
        if (i !== -1) result.indices = [...result.indices].splice(i, 1);
      }
      return result;
    }
    return {
      ...table,
      values: { ...table.values, [k]: value },
      ...(typeof k === 'number' && table.indices.indexOf(k) === -1
        ? { indices: [...table.indices, k].sort((a, b) => a - b) }
        : {}),
    };
  }),
  merge: tableFunc((table, value) => {
    if (value.type !== 'table') return table;
    const result = {
      ...table,
      values: { ...table.values },
      indices: [...table.indices],
    };
    const start = table.indices[table.indices.length - 1] || 0;
    const values = { ...value.value.values };
    for (const i of value.value.indices) {
      result.values[start + i] = values[i];
      result.indices.push(start + i);
      delete values[i];
    }
    result.values = { ...result.values, ...values };
    return result;
  }),
  fill: tableFunc((table, value) => ({
    values: table.values,
    indices: table.indices,
    ...(value.type !== 'nil' ? { fill: { value } } : {}),
  })),
  fillGroup: tableFunc((table, value) => ({
    values: table.values,
    indices: table.indices,
    ...(value.type !== 'nil' ? { fill: { value, gruop: true } } : {}),
  })),
  '~': ([a, b]) => ({ ...b, id: a }),
  or: ([a, b]) => (a.type === 'nil' ? b : a),
  and: ([a, b]) => (a.type === 'nil' ? a : b),
  '=': ([a, b]) => toData(a.type === b.type && a.value === b.value),
  '!=': ([a, b]) => toData(a.type !== b.type || a.value !== b.value),
  '<': typeFunc(toString, (a, b) => sortStrings(a, b) === 1),
  '>': typeFunc(toString, (a, b) => sortStrings(a, b) === -1),
  '<=': typeFunc(toString, (a, b) => sortStrings(a, b) !== 1),
  '>=': typeFunc(toString, (a, b) => sortStrings(a, b) !== -1),
  '|': typeFunc(toString, (a, b) => {
    return a + b;
  }),
  '+': typeFunc(toNumber, (a, b) => a + b),
  '-': typeFunc(toNumber, (a, b) => a - b),
  '*': typeFunc(toNumber, (a, b) => a * b),
  '/': typeFunc(toNumber, (a, b) => a / b),
  '%': typeFunc(toNumber, (a, b) => ((a % b) + b) % b),
  '^': typeFunc(toNumber, (a, b) => a ** b),
  not: ([a]) =>
    a.type === 'nil' ? { type: 'string', value: '1' } : { type: 'nil' },
  '-1': ([a]) => {
    if (a.type === 'table') return tableGet(a.value, '-1');
    const n = toNumber(a);
    if (n !== null) return { type: 'string', value: `${-n}` };
    return { type: 'nil' };
  },
};

export const toFunc = func => {
  if (func.type === 'function') return func.value;
  if (func.type === 'count') {
    return (_, emit) => {
      let count = 0;
      return { value: count, update: () => emit(count++) };
    };
  }
  if (func.type === 'date') {
    return (initial, emit) => {
      let value = initial;
      const interval = setInterval(() => {
        emit(toDateData(value));
      }, 1000);
      return {
        value: toDateData(value),
        update: v => {
          if (!v) {
            clearInterval(interval);
          } else {
            value = v;
            emit(toDateData(value));
          }
        },
      };
    };
  }
  if (func.type === 'table') {
    return (initial, emit) => {
      let result = { type: 'nil' };
      let updaters = {};
      const update = value => {
        if (!value) {
          for (const key of Object.keys(updaters)) {
            updaters[key]();
          }
          return false;
        }
        let doEmit = false;
        const updateKey = (k, v) => {
          result = maps.assign([result, k, v]);
          doEmit = true;
        };
        if (value.type !== 'nil' && value.type !== 'table') {
          result = { type: 'nil' };
          updaters = {};
        } else {
          const keys = Array.from(
            new Set([
              ...Object.keys(func.value.values),
              ...Object.keys(value.value.values),
            ]),
          );
          for (const key of keys) {
            const k = toData(key);
            const keyValues = {
              func: tableGet(func.value, k),
              value: tableGet(value.value, k),
            };
            if (updaters[key]) {
              updaters[key](keyValues.value);
            } else {
              const f = toFunc(keyValues.func);
              const { value: res, update } = f(keyValues.value, v =>
                updateKey(k, v),
              );
              updateKey(k, res);
              updaters[key] = update;
            }
          }
          for (const key of Object.keys(updaters).filter(
            k => !keys.includes(k),
          )) {
            updaters[key]();
            delete updaters[key];
            updateKey(toData(key), { type: 'nil' });
          }
        }
        return doEmit;
      };
      update(initial);
      return { value: result, update: v => update(v) && emit(result) };
    };
  }
  return (initial, emit) => {
    const map = value => {
      if (func.type === 'nil' || func.type === 'string') {
        if (value.type === 'table') {
          return tableGet(value.value, func);
        }
        if (func.type === 'nil' || value.type === 'nil') {
          return { type: 'nil' };
        }
        if (func.type === 'string' && value.type === 'string') {
          if (func.value === '-') {
            const v = stringToValue(value.value);
            if (typeof v === 'string') return { type: 'nil' };
            return { type: 'string', value: `${-v}` };
          }
          return { type: 'string', value: `${func.value} ${value.value}` };
        }
        return { type: 'nil' };
      }
    };
    return { value: map(initial), update: v => v && emit(map(v)) };
  };
};
