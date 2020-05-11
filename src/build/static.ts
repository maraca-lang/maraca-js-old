import { blockIsResolved } from '../block/resolve';

export default (create, args, ...maps) => {
  const map = maps.pop();
  const configMap = maps.pop();
  if (
    args.every(
      (a) =>
        a.type === 'value' ||
        (a.type === 'block' && blockIsResolved(a.value)) ||
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
  return create((set, get, create) => {
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
  });
};
