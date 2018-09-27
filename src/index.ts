const isObject = v => Object.prototype.toString.call(v) === '[object Object]';
const toIndex = v => (/^[\d\.]+$/.test(v) ? parseFloat(v) : null);

const diff = (next, prev) => {
  if (next && prev && isObject(next) !== isObject(prev)) {
    return diff(next, null);
  }
  if (!isObject(next)) return next === prev ? undefined : next;
  const nextKeys = Object.keys(next);
  const prevKeys = Object.keys(prev || {});
  const pairs = Array.from(new Set([...nextKeys, ...prevKeys]))
    .map(key => {
      if (next[key] === undefined) return { key, diff: undefined };
      const prevKey = prevKeys.find(
        k => (prev[k][1] || k) === (next[key][1] || key),
      );
      const prevData = prev && prevKey && prev[prevKey][0];
      const d = diff(next[key][0], prevData);
      if (prevData === null || key === prevKey) {
        return d === undefined ? undefined : { key, diff: d };
      }
      return { key, diff: { diff: d, ...(prevKey ? { prev: prevKey } : {}) } };
    })
    .filter(x => x) as any[];
  return pairs.length === 0
    ? undefined
    : pairs.reduce((res, { key, diff }) => ({ ...res, [key]: diff }), {});
};

let counter = 0;
const createStream = (getCurrent, run?) => {
  const listeners: any[] = [];
  let stop;
  return (listener?) => {
    if (!listener) return getCurrent();
    listeners.push(listener);
    if (listeners.length === 1 && run) {
      stop = run(data => listeners.forEach(l => l(data)));
    }
    return () => {
      listeners.splice(listeners.indexOf(listener), 1);
      if (listeners.length === 0 && stop) stop();
    };
  };
};

const createConstant = data => {
  const count = counter++;
  return createStream(() => [data, undefined, count]);
};

const createTable = streams => {
  if (streams.length === 0) return createConstant(null);
  const combine = items =>
    items.reduce((res, [{ key, data }]) => ({ ...res, [key]: data }), {});
  return createStream(
    () => {
      const data = streams.map(stream => stream());
      return [combine(data), undefined, Math.max(...data.map(d => d[2]))];
    },
    emit => {
      const values = streams.map(stream => stream());
      const unobservers = streams.map((stream, i) =>
        stream(data => {
          values[i] = data;
          emit([combine(values), undefined, data[2]]);
        }),
      );
      return () => unobservers.forEach(u => u());
    },
  );
};

const mapStream = (stream, func) => {
  const map = data => {
    const [value, id] = func(data);
    return [value, id, data[2]];
  };
  return createStream(
    () => map(stream()),
    emit => stream(data => emit(map(data))),
  );
};

const createRecord = streamMap =>
  createTable(
    Object.keys(streamMap).map(key =>
      mapStream(streamMap[key], data => [{ key, data }]),
    ),
  );

const setId = stream =>
  mapStream(stream, ([{ 1: id, 2: value }]) => [value, id]);

const createEmitter = (initial = null as any) => {
  let current = [initial, undefined, counter++];
  let emit;
  return {
    stream: createStream(
      () => current,
      emitInner => {
        emit = emitInner;
        return () => (emit = undefined);
      },
    ),
    emit: data => {
      current = [data, undefined, counter++];
      if (emit) emit(current);
    },
  };
};

const mergeTable = stream =>
  mapStream(stream, ([value]) => {
    const keys = (Object.keys(value)
      .map(toIndex)
      .filter(n => n) as number[]).sort((a, b) => b - a);
    if (keys.length === 0) return [null, undefined, counter++];
    const latest = Math.max(...keys.map(k => value[k][2]));
    return value[keys.find(k => value[k][2] === latest)!];
  });

const wrapStop = (stream, onStop) => listener => {
  if (!listener) return stream();
  const stop = stream(listener);
  return () => {
    onStop();
    stop();
  };
};

const createObserver = stream => listener => {
  let current = stream()[0];
  listener(diff(current, null));
  return stream(([value]) => {
    listener(diff(value, current));
    current = value;
  });
};

const createRunner = streamFunc => (initial, listener) => {
  const { stream, emit } = createEmitter(initial);
  const stop = createObserver(streamFunc(stream))(listener);
  return data => (data === undefined ? stop() : emit(data));
};

const getIndices = v =>
  Object.keys(v)
    .map(k => {
      const i = parseInt(k);
      return !isNaN(i) && `${i}` === k ? i : null;
    })
    .filter(i => i) as number[];

const methods = {
  add: ({ [0]: a, [1]: b }) => a + b,
  last: a => {
    const indices = getIndices(a);
    return indices.length === 0 ? null : Math.max(...indices);
  },
  get: ({ [0]: a, [1]: b }) => a[b] || null,
  map: func => a =>
    Object.keys(a).reduce(
      (res, k) => ({ ...res, [k]: { id: a[k].id, data: func(a[k].data) } }),
      {},
    ),
};

// const concatStreams = streamStream =>
//   createStream(
//     () => streamStream()(),
//     emit => {
//       let stopInner = streamStream()(emit);
//       const stopOuter = streamStream(stream => {
//         stopInner();
//         stopInner = stream(emit);
//       });
//       return () => {
//         stopInner();
//         stopOuter();
//       };
//     },
//   );

// const deriveStream = (stream, func) => concatStreams(mapStream(stream, func));

const watch = stream =>
  createObserver(stream)(
    d =>
      d === undefined ? 'undefined' : console.log(JSON.stringify(d, null, 2)),
  );

const { emit, stream } = createEmitter(10);

// // watch(
// //   deriveStream(stream, pack => {
// //     const value = get(pack);
// //     let current = 1;
// //     const emitter = createEmitter(current, types.basic);
// //     const interval = setInterval(() => emitter.emit(current++), value * 1000);
// //     return wrapStop(emitter.stream, () => clearInterval(interval));
// //   }),
// // );
// // setTimeout(() => emit(0.5), 3);

const a = createConstant(1);
// const b = val(2);
const c = createRecord({ a, c: stream });
watch(c);

emit(5);
emit(8);

// a . f [b . g c]

/*

nil
number
string
table
function
source

tables are keyed by nil, number and string
=> values can have ids, which are followed for diffing
=> if blank id, treated as the same as key

nil, number and string can be used as functions
=> nil/number on number: multiplication
=> nil/string on string: concatenation
=> any on table/nul: getter (get on nil always nil)

functions take one argument
=> can return another function, effectively making multi-arg function

*/
