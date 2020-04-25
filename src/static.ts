import Block from './block';
import { streamMap } from './util';

export const createStaticBlock = (items = {}) => ({
  type: 'constant',
  static: items,
  value: { type: 'block', value: new Block() },
});

const id = (x) => x;
export const mergeStatic = (create, args, deep, ...maps) => {
  const map = maps.pop();
  const configMap = maps.pop();
  if (args.every((a) => a.type !== 'any')) {
    if (args.every((a) => a.type === 'constant')) {
      const mapped = args.map((a) => a.value);
      return {
        type: 'constant',
        value: map(configMap ? configMap(mapped, id) : mapped, id),
      };
    }
    const allArgs = args
      .filter((a) => a.type !== 'constant')
      .map((a) => (a.type === 'map' ? a.arg : a));
    if (allArgs.every((a) => a === allArgs[0])) {
      const combinedMap = (x) => {
        const mapped = args.map((a) => {
          if (a.type === 'constant') return a.value;
          if (a.type === 'map') return a.map(x);
          return x;
        });
        return map(configMap ? configMap(mapped, id) : mapped, id);
      };
      return {
        type: 'map',
        arg: allArgs[0],
        deep,
        map: combinedMap,
        value: create(
          streamMap((get) => combinedMap(get(allArgs[0].value, deep))),
        ),
      };
    }
  }
  const mapped = args.map((a) => a.value);
  return {
    type: 'any',
    value: create((set, get, create) => {
      let result;
      let prev = [];
      return () => {
        const next = configMap ? configMap(mapped, get) : mapped;
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

export const staticAssign = ([current, value, key]: any[], append) => {
  const result = { ...current.static };
  if (!(append && value.type === 'any')) {
    if (
      !append &&
      (!key || (key.type === 'constant' && key.value.type !== 'block'))
    ) {
      result[(key && key.value.value) || ''] = value;
    }
    return result;
  }
};

export const staticCombine = (s1, s2) => {
  if (
    [s1, s2].some((a) => a.static) &&
    [s1, s2].some((a) => a.type === 'constant' && a.value.type !== 'block')
  ) {
    const [block, key] = s1.static ? [s1, s2] : [s2, s1];
    if (block.static[key.value.value || '']) {
      return block.static[key.value.value || ''];
    }
  }
};

export const staticMerge = (scope, current) =>
  current ? { ...scope, ...current } : {};
