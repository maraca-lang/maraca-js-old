import build from './build';
import { combineConfig, combineRun } from './combine';
import parse from './parse';
import mergeStatic from './static';
import { createBlock, toPairs } from './utils/block';
import { compare, fromJs, print, toIndex, toNumber } from './utils/data';
import { streamMap } from './utils/misc';

const dataMap = (map, deep?) => (args, get) =>
  fromJs(map(args.map((a, i) => get(a, deep && deep[i]))));

const numericMap = (map) =>
  dataMap((args) => {
    const values = args.map((a) => toNumber(a.value));
    if (values.some((v) => v === null)) return null;
    return map(values);
  });

const operators = {
  '=': dataMap(
    ([a, b]) => {
      if (a.type !== b.type) return false;
      if (a.type == 'value') return a.value === b.value;
      return print(a) === print(b);
    },
    [true, true],
  ),
  '!': dataMap(([a, b]) => {
    if (!b) return !a.value;
    return a.type !== b.type || a.value !== b.value;
  }),
  '<': dataMap(([a, b]) => compare(a, b) === -1, [true, true]),
  '>': dataMap(([a, b]) => compare(a, b) === 1, [true, true]),
  '<=': dataMap(([a, b]) => compare(a, b) !== 1, [true, true]),
  '>=': dataMap(([a, b]) => compare(a, b) !== -1, [true, true]),
  '+': numericMap(([a, b]) => a + b),
  '-': dataMap(([a, b]) => {
    if (!b) return a.type === 'value' ? `-${a.value}` : null;
    const [x, y] = [toNumber(a.value), toNumber(b.value)];
    return x !== null && y !== null ? x - y : null;
  }),
  '*': numericMap(([a, b]) => a * b),
  '/': numericMap(([a, b]) => a / b),
  '%': numericMap(([a, b]) => ((((a - 1) % b) + b) % b) + 1),
  '^': numericMap(([a, b]) => a ** b),
};

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

  if (type === 'size') {
    return mergeStatic(create, args, (args, get) => {
      const value = get(args[0], true);
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
    return args.reduce((a1, a2) =>
      mergeStatic(create, [a1, a2], combineConfig, combineRun),
    );
  }

  if (type === 'map') {
    return mergeStatic(create, args, (args, get) =>
      operators[info.func](args, get),
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
