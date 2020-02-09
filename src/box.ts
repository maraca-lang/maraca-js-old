import { fromJs, sortMultiple, toIndex, toString } from './data';
import { Data, Obj, isValue, StreamData } from './typings';

const tryNumber = s => {
  const n = parseFloat(s);
  return !isNaN(s) && !isNaN(n) ? n : s;
};
const getMinus = v => {
  if (!v) return { minus: false, v };
  const minus = typeof v === 'number' ? v < 0 : v[0] === '-';
  if (!minus) return { minus, value: v };
  return { minus, value: typeof v === 'number' ? -v : v.slice(1) };
};
const sortStrings = (s1, s2): -1 | 0 | 1 => {
  if (s1 === s2) return 0;
  if (!s1) return -1;
  if (!s2) return 1;
  const n1 = tryNumber(s1);
  const n2 = tryNumber(s2);
  const m1 = getMinus(n1);
  const m2 = getMinus(n2);
  if (m1.minus !== m2.minus) return m1.minus ? -1 : 1;
  const dir = m1.minus ? -1 : 1;
  const t1 = typeof m1.value;
  const t2 = typeof m2.value;
  if (t1 === t2) {
    if (t1 === 'string') {
      return (dir * m1.value.localeCompare(m2.value)) as -1 | 0 | 1;
    }
    return (dir * (m1.value < m2.value ? -1 : 1)) as -1 | 0 | 1;
  }
  return (dir * (t1 === 'number' ? -1 : 1)) as -1 | 0 | 1;
};
const compare = (v1, v2): -1 | 0 | 1 => {
  const type1 = v1.value ? v1.type : 'nil';
  const type2 = v2.value ? v2.type : 'nil';
  if (type1 !== type2) {
    return type1 === 'value' || type2 === 'box' ? -1 : 1;
  }
  if (type1 === 'nil') return 0;
  if (type1 === 'value') return sortStrings(v1.value, v2.value);
  const keys = Array.from(
    new Set([...Object.keys(v1.value.values), ...Object.keys(v2.value.values)]),
  ).sort((a, b) =>
    compare(
      (v1.value.values[a] || (v2 as any).value.values[a]).key,
      (v1.value.values[b] || (v2 as any).value.values[b]).key,
    ),
  );
  return sortMultiple(
    keys.map(
      k =>
        (v1.value.values[k] && v1.value.values[k].value) || {
          type: 'value',
          value: '',
        },
    ),
    keys.map(
      k =>
        (v2.value.values[k] && v2.value.values[k].value) || {
          type: 'value',
          value: '',
        },
    ),
    compare,
  );
};

export default class Box {
  private values: Obj<{ key: Data; value: StreamData }> = {};
  private indices: number[] = [];
  private func?: any;

  static fromPairs(pairs: { key: Data; value: StreamData }[]) {
    const result = new Box();
    pairs.forEach(pair => {
      const k = toString(pair.key);
      const i = toIndex(k);
      if (!i || pair.value) {
        if (!result.values[k] || pair.value) result.values[k] = pair;
        if (i) result.indices.push(i);
      }
    });
    result.indices.sort((a, b) => a - b);
    return result;
  }
  static fromFunc(func, isMap?) {
    const result = new Box();
    result.func = Object.assign(func, { isMap });
    return result;
  }
  static fromArray(items: Data[]) {
    const result = new Box();
    result.values = items.reduce(
      (res, v, i) => ({
        ...res,
        [i + 1]: { key: fromJs(i + 1), value: v },
      }),
      {},
    );
    result.indices = items.map((_, i) => i + 1);
    return result;
  }

  toPairs() {
    return Object.keys(this.values)
      .map(k => this.values[k])
      .sort((a, b) => compare(a.key, b.key));
  }
  cloneValues() {
    const result = new Box();
    result.values = { ...this.values };
    result.indices = [...this.indices];
    return result;
  }

  has(key: Data) {
    const k = toString(key);
    return !!(this.values[k] && this.values[k].value);
  }
  get(key: Data) {
    const k = toString(key);
    const v = this.values[k] && this.values[k].value;
    return v || this.func || { type: 'value', value: '' };
  }
  extract(keys: Data[], doOffset: boolean) {
    const rest = this.cloneValues();
    const values = keys.map(key => {
      const k = toString(key);
      const i = toIndex(k);
      const v = (rest.values[k] && rest.values[k].value) || {
        type: 'value',
        value: '',
      };
      delete rest.values[k];
      if (i) rest.indices = rest.indices.filter(x => x !== i);
      return v;
    });
    const offset = rest.indices[0] - 1;
    if (doOffset && offset !== 0) {
      rest.indices.forEach((index, i) => {
        rest.values[index - offset] = rest.values[index];
        rest.values[index - offset].key = fromJs(index - offset);
        delete rest.values[index];
        rest.indices[i] = index - offset;
      });
    }
    return { values, rest };
  }
  getFunc() {
    return this.func;
  }

  map(map: (value: StreamData, key: Data) => StreamData) {
    const result = Box.fromPairs(
      Object.keys(this.values).map(k => ({
        key: this.values[k].key,
        value: map(this.values[k].value, this.values[k].key),
      })),
    );
    result.func = this.func;
    return result;
  }

  clearIndices() {
    const result = new Box();
    result.values = { ...this.values };
    this.indices.forEach(i => {
      delete result.values[i];
    });
    result.func = this.func;
    return result;
  }
  append(value: Data) {
    const i = (this.indices[this.indices.length - 1] || 0) + 1;
    const result = new Box();
    result.values = { ...this.values, [i]: { key: fromJs(i), value } };
    result.indices = [...this.indices, i];
    result.func = this.func;
    return result;
  }
  set(key: Data, value: Data) {
    const k = toString(key);
    const i = toIndex(k);
    const result = new Box();
    result.values = { ...this.values, [k]: { key, value } } as any;
    result.indices =
      i && !this.indices.includes(i)
        ? [...this.indices, i].sort((a, b) => a - b)
        : this.indices;
    result.func = this.func;
    return result;
  }
  destructure(key: Data, value: Data): Box {
    if ((!key || !isValue(key)) && !isValue(value)) {
      if (!key) {
        const offset = this.indices[this.indices.length - 1] || 0;
        return value.value.toPairs().reduce<Box>((res, v) => {
          const i = toIndex(toString(v.key));
          return res.destructure(
            i ? fromJs(i + offset) : v.key,
            v.value as any,
          );
        }, this);
      }
      const keyPairs = key.value.toPairs();
      const { values } = value.value.extract(
        keyPairs.map(d => d.key),
        false,
      );
      return values.reduce<Box>(
        (res, v, i) => res.destructure(keyPairs[i].value as any, v as any),
        this,
      );
    }
    return this.set(key || { type: 'value', value: '' }, value);
  }
  setFunc(func, isMap?, hasArg?, isPure?) {
    const result = new Box();
    result.values = this.values;
    result.indices = this.indices;
    result.func = Object.assign(func, { isMap, hasArg, isPure });
    return result;
  }

  toJSON() {
    return `[${this.toPairs()
      .filter(x => x.value)
      .map(({ key, value }) => `${toString(key)}: ${toString(value)}`)
      .join(', ')}]`;
  }
}
