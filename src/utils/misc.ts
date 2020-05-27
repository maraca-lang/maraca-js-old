export const isResolved = (data) => {
  if (data.type === 'value') return true;
  if (data.type === 'block') return !data.value.unresolved;
  return false;
};

const nilValue = { type: 'value', value: '' };
export const resolveType = (data, get) => {
  const d = data || nilValue;
  if (d.type === 'map') return resolveType(d.map(d.arg, get), get);
  if (d.type === 'stream') return resolveType(get(d.value), get);
  if (d.type === 'build') return resolveType(d.value(), get);
  return d;
};

export const wrapBuild = (build) => {
  let result;
  return {
    type: 'build',
    value: () => {
      if (!result) result = build();
      return result;
    },
  };
};

export const wrapStream = (create, x) =>
  x.type === 'stream' ? { type: 'stream', value: create((set) => set(x)) } : x;

export const streamMap = (map) => (set, get) => () => set(map(get));

export const mergeMap = (args, map, other) => {
  if (
    args.every(
      (a) =>
        a.type === 'value' ||
        (a.type === 'block' && !a.value.unresolved) ||
        a.type === 'map',
    )
  ) {
    const mapArgs = args.filter((a) => a.type === 'map').map((a) => a.arg);
    if (mapArgs.length === 0) {
      return map(args, (x) => x);
    }
    if (mapArgs.every((a) => a === mapArgs[0])) {
      return {
        type: 'map',
        arg: mapArgs[0],
        map: (x, get) =>
          map(
            args.map((a) => (a.type === 'map' ? a.map(x, get) : a)),
            get,
          ),
      };
    }
  }
  return other && { type: 'stream', value: other() };
};
