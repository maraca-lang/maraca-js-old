let counter = 1;

const create = (getCurrent, run?) => {
  const listeners: any[] = [];
  let stop;
  return (listener?) => {
    if (!listener) return getCurrent();
    listeners.push(listener);
    if (listeners.length === 1 && run) {
      stop = run(item => listeners.forEach(l => l(item)));
    }
    return () => {
      listeners.splice(listeners.indexOf(listener), 1);
      if (listeners.length === 0 && stop) stop();
    };
  };
};

const map = (stream, func) => {
  const get = ({ data, count }) => ({ data: func(data), count });
  return create(() => get(stream()), emit => stream(item => emit(get(item))));
};

const combine = (streams, get) =>
  create(
    () => get(streams.map(stream => stream())),
    emit => {
      const items = streams.map(stream => stream());
      const stops = streams.map((stream, i) =>
        stream(item => {
          items[i] = item;
          emit(get(items));
        }),
      );
      return () => stops.forEach(u => u());
    },
  );

export default {
  create: (getCurrent, run?) =>
    create(
      () => ({ data: getCurrent(), count: 0 }),
      emit => run && run(data => emit({ data, count: counter++ })),
    ),
  constant: data => create(() => ({ data, count: 0 })),
  emitter: initial => {
    let current = { data: initial, count: 0 };
    let emit;
    return {
      stream: create(
        () => current,
        emitInner => {
          emit = emitInner;
          return () => (emit = undefined);
        },
      ),
      emit: data => {
        current = { data, count: counter++ };
        if (emit) emit(current);
      },
    };
  },
  map,
  group: (streams, func) =>
    combine(streams, items => ({
      data: func(items.map(i => i.data)),
      count: Math.max(...items.map(i => i.count)),
    })),
  merge: streams =>
    combine(streams, items => {
      const count = Math.max(...items.map(i => i.count));
      return {
        data: [...items].reverse().find(i => i.count === count).data,
        count,
      };
    }),
  flatMap: (stream, func) => {
    const streamStream = map(stream, func);
    const get = (count, item) => ({
      data: item.data,
      count: Math.max(count, item.count),
    });
    return create(
      () => {
        const { data: innerStream, count } = streamStream();
        return get(count, innerStream());
      },
      emit => {
        const { data: innerStream, count } = streamStream();
        let stopInner = innerStream(item => emit(get(count, item)));
        const stopOuter = streamStream(({ data: innerStream, count }) => {
          stopInner();
          emit(get(count, innerStream()));
          stopInner = innerStream(item => emit(get(count, item)));
        });
        return () => {
          stopInner();
          stopOuter();
        };
      },
    );
  },
};
