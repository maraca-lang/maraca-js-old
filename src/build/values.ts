import combine from '../block/combine2';
import resolve from '../block/resolve';
import parse from '../parse';
import {
  createBlock,
  fromJs,
  mergeStatic,
  snapshot,
  streamMap,
  toIndex,
  toPairs,
} from '../utils';

import build from './index';
import operators from './operators';

export default (create, type, info, args) => {
  if (type === 'nil' || type === 'error') {
    return { type: 'value', value: '' };
  }

  if (type === 'value') {
    return { type: 'value', value: info.value };
  }

  if (type === 'join') {
    return args.reduce((a1, a2, i) =>
      mergeStatic(create, [a1, a2], (args, get) => {
        const [v1, v2] = args.map((a) => resolve(a, get, false));
        if (v1.type === 'block' || v2.type === 'block') return fromJs(null);
        const hasSpace =
          info.space[i - 1] &&
          v1.value &&
          /\S$/.test(v1.value) &&
          v2.value &&
          /^\S/.test(v2.value);
        return fromJs(`${v1.value}${hasSpace ? ' ' : ''}${v2.value}`);
      }),
    );
  }

  if (type === 'size') {
    return mergeStatic(create, args, (args, get) => {
      const value = resolve(args[0], get, true);
      if (value.type === 'block') {
        return fromJs(toPairs(value.value).filter((d) => d.value.value).length);
      }
      const num = toIndex(value.value);
      if (num) {
        const result = createBlock();
        result.indices = Array.from({ length: num }).map((_, i) =>
          fromJs(i + 1),
        );
        return { type: 'block', value: result };
      }
      return fromJs(null);
    });
  }

  if (type === 'combine') {
    return args.reduce((a1, a2) => combine(create, a1, a2));
  }

  if (type === 'map') {
    return mergeStatic(create, args, (args, get) =>
      operators[info.func](args, get),
    );
  }

  if (type === 'eval') {
    return {
      type: 'stream',
      value: create(
        streamMap((get, create) => {
          try {
            const code = resolve(args[0], get, false);
            const arg = resolve(args[1], get, false);
            return build(
              create,
              () =>
                arg.type === 'block'
                  ? arg
                  : { type: 'block', value: createBlock() },
              parse(code.type === 'value' ? code.value : ''),
            );
          } catch (e) {
            console.log(e.message);
            return { type: 'value', value: '' };
          }
        }),
      ),
    };
  }

  if (type === 'trigger') {
    return {
      type: 'stream',
      value: create((set, get) => {
        let trigger;
        return () => {
          const newTrigger = resolve(args[0], get, true);
          if (trigger !== newTrigger && newTrigger.value) {
            set({ ...resolve(args[1], (x) => get(x, true), true) });
          }
          trigger = newTrigger;
        };
      }),
    };
  }

  if (type === 'push') {
    return {
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
  }
};
