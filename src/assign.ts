const assign = (get, [l, v, k]: any[], setNil, noDestructure, append) => {
  if (!k && append) {
    const value = get(v);
    if (!value.value) return l;
    return { type: 'block', value: get(l).value.append(value) };
  }
  if (!setNil) {
    const value = get(v);
    if (!value.value) return l;
  }
  const key = k && get(k, true);
  if (!noDestructure && (!key || key.type === 'block')) {
    const value = get(v);
    if (value.type === 'block') {
      if (!key) {
        return { type: 'block', value: get(l).value.unpack(value.value) };
      }
      const keyPairs = key.value.toPairs();
      const func = key.value.getFunc();
      const funcDefault = typeof func === 'object' && func;
      const { values, rest } = value.value.extract(
        keyPairs.map((d) => d.key),
        funcDefault,
      );
      const result = values.reduce(
        (res, v, i) =>
          assign(get, [res, v, keyPairs[i].value], true, false, false),
        l,
      );
      if (!funcDefault) return result;
      return assign(
        get,
        [result, { type: 'block', value: rest }, funcDefault],
        true,
        true,
        false,
      );
    }
  }
  return {
    type: 'block',
    value: get(l).value.set(key || { type: 'value', value: '' }, v),
  };
};

export default assign;
