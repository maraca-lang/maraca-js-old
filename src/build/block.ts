import func from '../func';
import { blockSet } from '../utils/block';
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
    if (info.pushable) args[0] = create(pushable(args[0]));
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
    const stream = create((_, get, create) => {
      let source;
      return () => {
        const dest = get(args[1]);
        const newSource = get(args[0], true);
        if (source && dest.push && source !== newSource) {
          dest.push(snapshot(create, newSource));
        }
        source = newSource;
      };
    });
    return { ...block, indices: [...block.indices, stream] };
  }

  if (type !== 'nil') {
    const stream = build(create, getScope, { type, info, nodes });
    return { ...block, indices: [...block.indices, stream] };
  }

  return block;
};
