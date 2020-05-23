import { resolve } from '../index';
import { printValue, toIndex } from '../utils';

import { resolveIndices, resolveSets } from './set';

const getIndexValue = (index, indices, get) => {
  const allIndices = resolveIndices(indices, get);
  let countTrue = 0;
  let countFalse = 0;
  for (let i = 0; i < allIndices.length; i++) {
    const result = resolve(allIndices[i], get, false);
    if (result.value) countTrue++;
    else countFalse++;
    if (countTrue === index) return result;
    if (countFalse > allIndices.length - i) return null;
  }
};

export default (block, key, get) => {
  if (key.type === 'value') {
    const k = printValue(key.value);
    const values = { ...block.values, ...resolveSets(block.streams, get) };
    const v = values[k] && values[k].value;
    if (v) return v;

    const i = toIndex(key.value);
    if (i) {
      const v = getIndexValue(i, block.indices, get);
      if (v) return v;
    }
  }
  return block.func || { type: 'value', value: '' };
};
