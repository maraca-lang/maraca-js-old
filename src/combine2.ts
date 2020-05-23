import { combineConfig, combineRun } from './combine';
import { isResolved } from './resolve';
import { cloneBlock } from './utils/block';
import { print } from './utils/data';

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

const mergeStatic = (create, args, ...maps) => {
  const map = maps.pop();
  const configMap = maps.pop();
  if (
    args.every(
      (a) =>
        a.type === 'value' ||
        (a.type === 'block' && !a.value.unresolved) ||
        a.type === 'map',
    )
  ) {
    const mapArgs = args.filter((a) => a.type === 'map').map((a) => a.arg);
    if (mapArgs.length === 0) {
      return map(
        configMap ? configMap(args, (x) => x) : args,
        (x) => x,
        create,
      );
    }
    if (mapArgs.every((a) => a === mapArgs[0])) {
      return {
        type: 'map',
        arg: mapArgs[0],
        map: (x, get) => {
          const mapped = args.map((a) =>
            a.type === 'map' ? a.map(x, get) : a,
          );
          return map(configMap ? configMap(mapped, get) : mapped, get);
        },
      };
    }
  }
  return {
    type: 'stream',
    value: create((set, get, create) => {
      let result;
      let prev = [];
      return () => {
        const next = configMap ? configMap(args, get) : args;
        if (
          !configMap ||
          prev.length !== next.length ||
          prev.some((x, i) => x !== next[i])
        ) {
          if (result && result.type === 'stream') result.value.cancel();
          result = map(next, get, create);
          set(result);
          prev = next;
        }
      };
    }),
  };
};

export default (create, s1, s2) =>
  mergeStatic(create, [s1, s2], combineConfig, combineRun);
