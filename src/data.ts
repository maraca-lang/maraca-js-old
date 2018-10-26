export const toData = value => {
  if (!value) return { type: 'nil' };
  if (value === true) return { type: 'string', value: '1' };
  if (typeof value === 'number') return { type: 'string', value: `${value}` };
  if (typeof value === 'string') return { type: 'string', value };
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return { type: 'string', value: value.toISOString() };
  }
  if (
    Object.keys(value).length === 2 &&
    Object.keys(value)
      .sort()
      .join(',') === 'lat,lng'
  ) {
    return { type: 'string', value: JSON.stringify(value) };
  }
  if (Array.isArray(value)) {
    const result = { values: [], indices: [] } as any;
    value.forEach((v, i) => {
      result.values.push({ key: toData(i + 1), value: toData(v) });
      result.indices.push(i + 1);
    });
    return { type: 'list', value: result };
  }
  const result = { values: [], indices: [] } as any;
  Object.keys(value).forEach((k: any) => {
    const n = !isNaN(k) && !isNaN(parseFloat(k)) && parseFloat(k);
    if (n) result.indices.push(n);
    result.values.push({ key: toData(k), value: toData(value[k]) });
  });
  result.indices.sort((a, b) => a - b);
  return { type: 'list', value: result };
};

const regexs = {
  time: /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)/,
  location: /{"lat":[0-9\.-]+,"lng":[0-9\.-]+}/,
};
export const toTypedValue = ({ type, value }) => {
  if (type !== 'string') return { type, value };
  if (!isNaN(value) && !isNaN(parseFloat(value))) {
    const v = parseFloat(value);
    return { type: Math.floor(v) === v ? 'integer' : 'number', value: v };
  }
  if (regexs.time.test(value)) {
    return { type: 'time', value: new Date(value) };
  }
  if (regexs.location.test(value)) {
    return { type: 'location', value: JSON.parse(value) };
  }
  return { type: 'string', value };
};

const stringToNatural = s =>
  s
    .split(/(\-?\d*\.?\d+)/)
    .filter(x => x)
    .map(x => toTypedValue({ type: 'string', value: x }).value);

const getMinus = v => {
  if (!v) return { minus: false, v };
  const minus = typeof v === 'number' ? v < 0 : v[0] === '-';
  if (!minus) return { minus, value: v };
  return { minus, value: typeof v === 'number' ? -v : v.slice(1) };
};

const sortMultiple = (items1, items2, sortItems) =>
  Array.from({ length: Math.max(items1.length, items2.length) }).reduce(
    (res, _, i) => {
      if (res !== 0) return res;
      if (items1[i] === undefined) return -1;
      if (items2[i] === undefined) return 1;
      return sortItems(items1[i], items2[i]);
    },
    0,
  ) as -1 | 0 | 1;

const sortStrings = (s1, s2) =>
  sortMultiple(stringToNatural(s1), stringToNatural(s2), (n1, n2) => {
    if (n1 === n2) return 0;
    const m1 = getMinus(n1);
    const m2 = getMinus(n2);
    if (m1.minus !== m2.minus) return m1.minus ? -1 : 1;
    const dir = m1.minus ? -1 : 1;
    const t1 = typeof m1.value;
    const t2 = typeof m2.value;
    if (t1 === t2) {
      if (t1 === 'string') return dir * m1.value.localeCompare(m2.value);
      return dir * (m1.value < m2.value ? -1 : 1);
    }
    return dir * (t1 === 'number' ? -1 : 1);
  });

export const compare = (v1, v2) => {
  if (v1.type !== v2.type) {
    return v1.type === 'string' || v2.type === 'list' ? -1 : 1;
  }
  if (v1.type === 'nil') return 0;
  if (v1.type === 'string') return sortStrings(v1.value, v2.value);
  const values1 = v1.value.values;
  const values2 = v2.value.values;
  const keys = [
    ...values1.map(x => x.key),
    ...values2
      .map(x => x.key)
      .filter(k => !values1.find(x => compare(k, x.key) === 0)),
  ].sort(compare);
  return sortMultiple(
    keys.map(k => {
      const v = values1.find(x => compare(k, x.key) === 0);
      return v ? v.value : { type: 'nil' };
    }),
    keys.map(k => {
      const v = values2.find(x => compare(k, x.key) === 0);
      return v ? v.value : { type: 'nil' };
    }),
    compare,
  );
};

export const list = {
  clearIndices: list => ({
    ...list,
    values: list.values.filter(v => toTypedValue(v).type !== 'integer'),
    indices: [],
  }),
  assign: (list, value, key) => {
    if (!key) {
      if (value.type === 'nil') return list;
      const n = (list.indices[list.indices.length - 1] || 0) + 1;
      return {
        ...list,
        values: [...list.values, { key: toData(n), value }].sort((a, b) =>
          compare(a.key, b.key),
        ),
        indices: [...list.indices, n],
      };
    }
    const typed = toTypedValue(key);
    const n = typed.type === 'integer' && typed.value;
    const result = {
      ...list,
      values: list.values.filter(v => compare(v.key, key) !== 0),
      indices: list.indices,
    };
    if (n) {
      const i = result.indices.indexOf(n);
      if (i !== -1) {
        result.indices = [
          ...result.indices.slice(0, i),
          ...result.indices.slice(i + 1),
        ];
      }
    }
    if (value.type !== 'nil' || value.set) {
      result.values = [...result.values, { key, value }].sort((a, b) =>
        compare(a.key, b.key),
      );
      if (n) {
        result.indices = [...result.indices, n].sort((a, b) => a - b);
      }
    }
    return result;
  },
  unpack: (list, value) => {
    if (value.type !== 'list') return list;
    const result = {
      ...list,
      values: [...list.values],
      indices: [...list.indices],
    };
    const start = list.indices[list.indices.length - 1] || 0;
    const values = [...value.value.values];
    for (const i of value.value.indices) {
      const [v] = values.splice(
        values.findIndex(x => compare(x.key, toData(i)) === 0),
        1,
      );
      result.values.push({ key: toData(start + i), value: v.value });
      result.indices.push(start + i);
    }
    result.values = [...result.values, ...values].sort((a, b) =>
      compare(a.key, b.key),
    );
    return result;
  },
  other: (list, value, type) => ({
    values: list.values,
    indices: list.indices,
    other: value,
    otherType: type,
  }),
};
