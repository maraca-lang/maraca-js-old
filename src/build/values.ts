import combine from '../block/combine';
import { mapBlock, toPairs } from '../block/set';
import { resolve } from '../index';
import parse from '../parse';
import {
  createBlock,
  fromJs,
  mergeMap,
  pushable,
  streamMap,
  resolveType,
  toIndex,
} from '../utils';

import build from './index';
import operators from './operators';

const mergeMapSimple = (create, args, map) =>
  mergeMap(args, map, () => create(streamMap((get) => map(args, get, create))));

const snapshot = (create, { push, ...value }) => {
  const result =
    value.type !== 'block'
      ? value
      : {
          type: 'block',
          value: mapBlock(
            value.value,
            (x) => snapshot(create, x),
            (x) => x,
          ),
        };
  if (!push) return result;
  return { type: 'stream', value: create(pushable(result), true) };
};

export default (create, type, info, args) => {
  if (type === 'nil' || type === 'error') {
    return { type: 'value', value: '' };
  }

  if (type === 'value') {
    return { type: 'value', value: info.value };
  }

  if (type === 'join') {
    return args.reduce((a1, a2, i) =>
      mergeMapSimple(create, [a1, a2], (args, get) => {
        const [v1, v2] = args.map((a) => resolveType(a, get));
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
    return mergeMapSimple(create, args, (args, get) => {
      const value = resolve(args[0], get);
      if (value.type === 'block') {
        return fromJs(
          toPairs(value.value, get).filter((d) => d.value.value).length,
        );
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
    return args.reduce((a1, a2) => combine(create, [a1, a2]));
  }

  if (type === 'map') {
    return mergeMapSimple(create, args, (args, get) =>
      operators[info.func](args, get),
    );
  }

  if (type === 'eval') {
    return {
      type: 'stream',
      value: create(
        streamMap((get) => {
          try {
            const code = resolveType(args[0], get);
            const arg = resolveType(args[1], get);
            return build(
              create,
              () => (arg.type === 'block' ? arg.value : createBlock()),
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
          const newTrigger = resolve(args[0], get);
          if (trigger !== newTrigger && newTrigger.value) {
            set({ ...resolve(args[1], (x) => get(x, true)) });
          }
          trigger = newTrigger;
        };
      }),
    };
  }

  if (type === 'push') {
    return {
      type: 'stream',
      value: create((_, get) => {
        let source;
        return () => {
          const dest = resolveType(args[1], get);
          const newSource = resolve(args[0], get);
          if (source && dest.push && source !== newSource) {
            dest.push(snapshot(create, newSource));
          }
          source = newSource;
        };
      }),
    };
  }
};
