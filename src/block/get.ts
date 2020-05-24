import { printValue, resolveType, toIndex } from '../utils';

import { resolveIndices, resolveSets } from './set';

const getIndexValue = (index, indices, get) => {
  const allIndices = resolveIndices(indices, get);
  let countTrue = 0;
  let countFalse = 0;
  for (let i = 0; i < allIndices.length; i++) {
    const result = resolveType(allIndices[i], get);
    if (result.value) countTrue++;
    else countFalse++;
    if (countTrue === index) return result;
    if (countFalse > allIndices.length - i) return null;
  }
};

export default (block, key, get) => {
  if (key.type === 'value') {
    const k = printValue(key.value);

    const v1 = block.values[k] && block.values[k].value;
    if (v1) return v1;

    const streamValues = resolveSets(block.streams, get);
    const v2 = streamValues[k] && streamValues[k].value;
    if (v2) return v2;

    const i = toIndex(key.value);
    if (i) {
      const v3 = getIndexValue(i, block.indices, get);
      if (v3) return v3;
    }
  }
  return block.func || { type: 'value', value: '' };
};
