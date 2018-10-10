const toNumber = s => {
  const v = !isNaN(s) && !isNaN(parseFloat(s)) ? parseFloat(s) : s;
  return v && typeof v === 'number' && Math.floor(v) === v ? v : null;
};

const convert = x => {
  if (!x) return { type: 'nil' };
  if (Object.prototype.toString.call(x) === '[object Date]') {
    return { type: 'string', value: x.toISOString() };
  }
  if (Array.isArray(x)) {
    const value = { values: {}, indices: [] } as any;
    x.forEach((v, i) => {
      value.values[i + 1] = convert(v);
      value.indices.push(i + 1);
    });
    return { type: 'table', value };
  }
  if (typeof x === 'object') {
    const value = { values: {}, indices: [] } as any;
    Object.keys(x).forEach(k => {
      const n = toNumber(k);
      if (n) value.indices.push(n);
      value.values[k] = convert(x[k]);
    });
    value.indices.sort((a, b) => a - b);
    return { type: 'table', value };
  }
  return { type: 'string', value: `${x}` };
};

export default convert;
