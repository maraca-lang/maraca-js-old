import build from '../build/index';
import mergeStatic from '../build/static';
import { streamMap } from '../util';

import func from './func';
import set from './set';

const pushable = (arg) => (set, get) => {
  const push = (v) => set({ ...v, push });
  return () => set({ push, ...get(arg) });
};

export default (
  create,
  getScope,
  newBlock,
  { type, info = {} as any, args = [] as any[] },
) => {
  if (type === 'func') {
    if (args.every((a) => !a) && !info.map) {
      const value = build(create, getScope, info.value);
      return mergeStatic(create, [newBlock, value], ([c, v], get) => ({
        type: 'block',
        value: get(c).value.setFunc(get(v)),
      }));
    }
    const funcArgs = func(create, getScope, info, args);
    return create(
      streamMap((get) => ({
        type: 'block',
        value: get(newBlock).value.setFunc(...funcArgs),
      })),
    );
  }

  if (type === 'set') {
    const assignArgs = [newBlock, ...[...args].filter((x) => x)];
    if (info.pushable) assignArgs[1] = create(pushable(assignArgs[1]));
    return mergeStatic(create, assignArgs, set(true, false));
  }
};
