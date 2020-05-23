import func from '../func';
import resolve, { blockSet, isResolved } from '../resolve';
import { pushable, snapshot } from '../utils/misc';

import build from './index';

export default (
  create,
  getScope,
  block,
  { type, info = {} as any, nodes = [] as any[] },
) => {
  const args = nodes.map((n) => n && build(create, getScope, n));

  if (type === 'set') {
    if (info.pushable) {
      args[0] = { type: 'stream', value: create(pushable(args[0])) };
    }
    return (blockSet as any)(block, ...args);
  }

  if (type === 'func') {
    if (args.every((a) => !a) && !info.map) {
      return { ...block, func: build(create, getScope, info.value) };
    } else {
      const [value, isMap, isPure] = func(create, getScope, info, args);
      return { ...block, func: Object.assign(value, { isMap, isPure }) };
    }
  }

  if (type === 'push') {
    const value = {
      type: 'stream',
      value: create((_, get, create) => {
        let source;
        return () => {
          const dest = resolve(args[1], get, false);
          const newSource = resolve(args[0], get, true);
          if (source && dest.push && source !== newSource) {
            dest.push(snapshot(create, newSource));
          }
          source = newSource;
        };
      }),
    };
    return { ...block, indices: [...block.indices, value], unresolved: true };
  }

  const value = build(create, getScope, { type, info, nodes });
  if (!value.value) return block;
  return {
    ...block,
    indices: [...block.indices, value],
    ...(block.unresolved || !isResolved(value) ? { unresolved: true } : {}),
  };
};
