import { compare, fromJs, print, toIndex } from '../data';
import { Data, Obj, StreamData } from '../typings';

const getIndex = (index, values, get) => {
  let countTrue = 0;
  let countFalse = 0;
  for (let i = 0; i < values.length; i++) {
    const result = get(values[i]);
    if (result.value) countTrue++;
    else countFalse++;
    if (countTrue === index) return result;
    if (countFalse > values.length - i) return null;
  }
};

export default class Block {
  private values: Obj<{ key: Data; value: StreamData }> = {};
  private indices: StreamData[] = [];
  private func?: any;

  static fromPairs(pairs: { key: Data; value: StreamData }[]) {
    const result = new Block();
    const indices = [] as any[];
    pairs.forEach((pair) => {
      const k = print(pair.key);
      const i = toIndex(k);
      if (i) {
        indices.push({ key: i, value: pair.value });
      } else {
        result.values[k] = pair;
      }
    });
    result.indices = indices.sort((a, b) => a.key - b.key).map((x) => x.value);
    return result;
  }
  static fromFunc(func, isMap?) {
    const result = new Block();
    result.func = Object.assign(func, { isMap });
    return result;
  }
  static fromArray(items: StreamData[]) {
    const result = new Block();
    result.values = {};
    result.indices = items;
    return result;
  }

  hasStreams() {
    return true;
  }

  toPairs() {
    const values = Object.keys(this.values)
      .map((k) => this.values[k])
      .sort((a, b) => compare(a.key, b.key));
    const indices = this.indices.map((value, i) => ({
      key: fromJs(i + 1),
      value,
    }));
    if (values[0] && !values[0].key.value) {
      return [values[0], ...indices, ...values.slice(1)];
    }
    return [...indices, ...values];
  }
  toBoth() {
    return {
      indices: this.indices,
      values: Object.keys(this.values).reduce((res, k) => {
        const key = k.startsWith("'")
          ? k.slice(1, -1).replace(/\\([\s\S])/g, (_, m) => m)
          : k;
        return { ...res, [key]: this.values[k].value };
      }, {}),
    };
  }
  cloneValues() {
    const result = new Block();
    result.values = { ...this.values };
    result.indices = [...this.indices];
    return result;
  }

  get(key, get) {
    if (key.type === 'block') return this.func || { type: 'value', value: '' };
    const i = toIndex(key.value);
    if (i) {
      return (
        getIndex(i, this.indices, get) ||
        this.func || { type: 'value', value: '' }
      );
    }
    const k = print(key);
    const v = this.values[k] && this.values[k].value;
    return v || this.func || { type: 'value', value: '' };
  }
  extract(keys: Data[], get) {
    const rest = new Block();
    rest.values = { ...this.values };
    rest.indices = this.indices.map((v) => get(v)).filter((x) => x.value);
    let maxIndex = 0;
    const values = keys.map((key) => {
      const k = print(key);
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
  }
  getFunc() {
    return this.func;
  }

  map(map: (value: StreamData, key: Data) => StreamData) {
    const result = Block.fromPairs(
      Object.keys(this.values).map((k) => ({
        key: this.values[k].key,
        value: map(this.values[k].value, this.values[k].key),
      })),
    );
    result.func = this.func;
    return result;
  }

  clearIndices() {
    const result = new Block();
    result.values = this.values;
    this.indices = [];
    result.func = this.func;
    return result;
  }
  append(value: StreamData) {
    const result = new Block();
    result.values = this.values;
    result.indices = [...this.indices, value];
    result.func = this.func;
    return result;
  }
  set(key: Data, value: Data) {
    const k = print(key);
    const result = new Block();
    result.values = { ...this.values, [k]: { key, value } } as any;
    result.indices = this.indices;
    result.func = this.func;
    return result;
  }
  unpack(value: Block) {
    const result = new Block();
    result.values = { ...this.values, ...value.values };
    result.indices = [...this.indices, ...value.indices];
    result.func = value.func || this.func;
    return result;
  }
  setFunc(func, isMap?, isPure?) {
    const result = new Block();
    result.values = this.values;
    result.indices = this.indices;
    result.func =
      typeof func === 'function'
        ? Object.assign(func, { isMap, isPure })
        : func;
    return result;
  }
}
