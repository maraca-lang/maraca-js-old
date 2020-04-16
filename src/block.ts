import { compare, fromJs, print, toIndex } from './data';
import { Data, Obj, isValue, StreamData } from './typings';

export default class Block {
  private values: Obj<{ key: Data; value: StreamData }> = {};
  private indices: number[] = [];
  private func?: any;

  static fromPairs(pairs: { key: Data; value: StreamData }[]) {
    const result = new Block();
    pairs.forEach((pair) => {
      const k = print(pair.key);
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
    const result = new Block();
    result.func = Object.assign(func, { isMap });
    return result;
  }
  static fromArray(items: Data[]) {
    const result = new Block();
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
      .map((k) => this.values[k])
      .sort((a, b) => compare(a.key, b.key));
  }
  toBoth() {
    const values = { ...this.values };
    return {
      indices: this.indices.map((i) => {
        const v = values[i].value;
        delete values[i];
        return v;
      }),
      values: Object.keys(values).reduce(
        (res, k) => ({ ...res, [k]: values[k].value }),
        {},
      ),
    };
  }
  cloneValues() {
    const result = new Block();
    result.values = { ...this.values };
    result.indices = [...this.indices];
    return result;
  }

  has(key: Data) {
    if (key.type === 'block') return false;
    const k = print(key);
    return !!(this.values[k] && this.values[k].value);
  }
  get(key: Data) {
    if (key.type === 'block') return this.func || { type: 'value', value: '' };
    const k = print(key);
    const v = this.values[k] && this.values[k].value;
    return v || this.func || { type: 'value', value: '' };
  }
  extract(keys: Data[], doOffset: boolean) {
    const rest = this.cloneValues();
    const values = keys.map((key) => {
      const k = print(key);
      const i = toIndex(k);
      const v = (rest.values[k] && rest.values[k].value) || {
        type: 'value',
        value: '',
      };
      delete rest.values[k];
      if (i) rest.indices = rest.indices.filter((x) => x !== i);
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
    result.values = { ...this.values };
    this.indices.forEach((i) => {
      delete result.values[i];
    });
    result.func = this.func;
    return result;
  }
  append(value: Data) {
    const i = (this.indices[this.indices.length - 1] || 0) + 1;
    const result = new Block();
    result.values = { ...this.values, [i]: { key: fromJs(i), value } };
    result.indices = [...this.indices, i];
    result.func = this.func;
    return result;
  }
  set(key: Data, value: Data) {
    const k = print(key);
    const i = toIndex(k);
    const result = new Block();
    result.values = { ...this.values, [k]: { key, value } } as any;
    result.indices =
      i && !this.indices.includes(i)
        ? [...this.indices, i].sort((a, b) => a - b)
        : this.indices;
    result.func = this.func;
    return result;
  }
  destructure(key: Data, value: Data): Block {
    if ((!key || !isValue(key)) && !isValue(value)) {
      if (!key) {
        const offset = this.indices[this.indices.length - 1] || 0;
        return value.value.toPairs().reduce<Block>((res, v) => {
          const i = toIndex(print(v.key));
          return res.destructure(
            i ? fromJs(i + offset) : v.key,
            v.value as any,
          );
        }, this);
      }
      const keyPairs = key.value.toPairs();
      const { values } = value.value.extract(
        keyPairs.map((d) => d.key),
        false,
      );
      return values.reduce<Block>(
        (res, v, i) => res.destructure(keyPairs[i].value as any, v as any),
        this,
      );
    }
    return this.set(key || { type: 'value', value: '' }, value);
  }
  setFunc(func, isMap?, hasArg?, isPure?) {
    const result = new Block();
    result.values = this.values;
    result.indices = this.indices;
    result.func = Object.assign(func, { isMap, hasArg, isPure });
    return result;
  }
}
