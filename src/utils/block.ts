import { isResolved } from '../resolve';

import { compare, fromJs, print, toIndex } from './data';
import { Data, StreamData } from './typings';

export const createBlock = () => {
  return { values: {}, streams: [], indices: [] } as any;
};

export const cloneBlock = (block) => ({
  values: { ...block.values },
  streams: [...block.streams],
  indices: [...block.indices],
  func: block.func,
  ...(block.unresolved ? { unresolved: true } : {}),
});

export const toPairs = (block) => {
  const values = Object.keys(block.values)
    .map((k) => block.values[k])
    .sort((a, b) => compare(a.key, b.key));
  const indices = block.indices.map((value, i) => ({
    key: fromJs(i + 1),
    value: value,
  }));
  if (values[0] && !values[0].key.value) {
    return [values[0], ...indices, ...values.slice(1)];
  }
  return [...indices, ...values];
};
export const fromPairs = (pairs: { key: Data; value: StreamData }[]) => {
  const result = createBlock();
  const indices = [] as any[];
  pairs.forEach((pair) => {
    const k = print(pair.key);
    const i = toIndex(k);
    if (i) {
      indices.push({ key: i, value: pair.value });
    } else {
      result.values[k] = pair;
    }
    if (!isResolved(pair.value)) result.unresolved = true;
  });
  result.indices = indices.sort((a, b) => a.key - b.key).map((x) => x.value);
  return result;
};

// export const blockSet = (block, value, key) => {
//   const result = cloneBlock(block);
//   if (!key) {
//     if (isResolved(value)) {
//       if (value.type === 'value') {
//         result.values = {
//           ...result.values,
//           ['']: { key: { type: 'value', value: '' }, value },
//         };
//       } else {
//         result.values = { ...result.values, ...value.value.values };
//         result.indices = [...result.indices, ...value.value.indices];
//       }
//     } else {
//       result.streams = [...result.streams, { value }];
//       result.indices = [...result.indices, { type: 'unpack', value }];
//     }
//     if (!isResolved(value)) result.unresolved = true;
//   } else if (key.type === 'value') {
//     result.values = { ...result.values, [print(key)]: { key, value } };
//     if (!isResolved(value)) result.unresolved = true;
//   } else {
//     result.streams = [...result.streams, { key, value }];
//     result.unresolved = true;
//   }
//   return result;
// };

export const blockSet = (block, value, key) => {
  const result = cloneBlock(block);
  if (!key) {
    result.streams = [...block.streams, { value }];
    result.indices = [...block.indices, { type: 'unpack', value }];
    result.unresolved = true;
    return result;
  }
  if (key.type === 'value') {
    result.values = { ...block.values, [print(key)]: { key, value } };
    if (!isResolved(value)) result.unresolved = true;
    return result;
  }
  result.streams = [...block.streams, { key, value }];
  result.unresolved = true;
  return result;
};
