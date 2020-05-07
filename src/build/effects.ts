import Block from '../block';
import func from '../func';
import set from '../set';
import { streamMap } from '../util';

import build from './index';
import mergeStatic from './static';

const pushable = (arg) => (set, get) => {
  const push = (v) => set({ ...v, push });
  return () => set({ push, ...get(arg) });
};

const snapshot = (create, { push, ...value }) => {
  const result =
    value.type !== 'block'
      ? value
      : {
          type: 'block',
          value: Block.fromPairs(
            value.value.toPairs().map(({ key, value }) => ({
              key,
              value: snapshot(create, value),
            })),
          ),
        };
  return push ? create(pushable(result), true) : result;
};

export default (
  create,
  context,
  { type, info = {} as any, nodes = [] as any[] },
) => {
  const args = nodes.map((n) => n && build(create, context, n));

  if (type === 'func') {
    if (args.every((a) => !a) && !info.map) {
      const value = build(create, context, info.value);
      return mergeStatic(create, [context.current, value], ([c, v], get) => ({
        type: 'block',
        value: get(c).value.setFunc(get(v)),
      }));
    }
    const funcArgs = func(create, context, info, args);
    const prevCurrent = context.current;
    return create(
      streamMap((get) => ({
        type: 'block',
        value: get(prevCurrent).value.setFunc(...funcArgs),
      })),
    );
  }

  if (type === 'set') {
    const assignArgs = [context.current, ...[...args].filter((x) => x)];
    if (info.pushable) assignArgs[1] = create(pushable(assignArgs[1]));
    return mergeStatic(create, assignArgs, set(true, false));
  }

  if (type === 'push') {
    const prevCurrent = context.current;
    return create((set, get, create) => {
      let source;
      set(prevCurrent);
      return () => {
        const dest = get(args[1]);
        const newSource = get(args[0], true);
        if (source && dest.push && source !== newSource) {
          dest.push(snapshot(create, newSource));
        }
        source = newSource;
      };
    });
  }
};