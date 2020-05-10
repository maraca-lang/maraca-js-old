import { createBlock, fromArray, toPairs } from '../block/block';
import { combineConfig, combineRun } from '../block/combine';
import build from '../build';
import { fromJs, toIndex } from '../data';
import parse from '../parse';
import { streamMap } from '../util';

import operators from './operators';
import mergeStatic from './static';

export default (create, type, info, args) => {
  if (type === 'nil' || (type === 'value' && !info.value) || type === 'error') {
    return { type: 'value', value: '' };
  }

  if (type === 'value') {
    return { type: 'value', value: info.value };
  }

  if (type === 'join') {
    return args.reduce((a1, a2, i) =>
      mergeStatic(create, [a1, a2], (args, get) => {
        const [v1, v2] = args.map((a) => get(a));
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

  if (type === 'combine') {
    return args.reduce((a1, a2) =>
      mergeStatic(create, [a1, a2], combineConfig, combineRun),
    );
  }

  if (type === 'map') {
    if (info.func === '#') {
      return mergeStatic(create, args, (args, get) => {
        const value = get(args[0], true);
        if (value.type === 'block') {
          return fromJs(
            toPairs(value.value).filter((d) => d.value.value).length,
          );
        }
        const num = toIndex(value.value);
        if (num) {
          return {
            type: 'block',
            value: fromArray(
              Array.from({ length: num }).map((_, i) => fromJs(i + 1)),
            ),
          };
        }
        return fromJs(null);
      });
    }

    const { map, deepArgs = [] } =
      typeof operators[info.func] === 'function'
        ? { map: operators[info.func] }
        : operators[info.func];
    return mergeStatic(create, args, (args, get) =>
      map(args.map((a, i) => get(a, deepArgs[i]))),
    );
  }

  if (type === 'eval') {
    return create(
      streamMap((get, create) => {
        try {
          const code = get(args[0]);
          const arg = get(args[1]);
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
    );
  }

  if (type === 'trigger') {
    return create((set, get) => {
      let trigger;
      return () => {
        const newTrigger = get(args[0], true);
        if (trigger !== newTrigger && newTrigger.value) {
          set({ ...get(args[1], true, true) });
        }
        trigger = newTrigger;
      };
    });
  }
};
