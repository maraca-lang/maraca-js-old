import { resolve, sortMultiple } from './data';

const createStreamBase = (index, value, onChange, run?) => {
  const listeners = new Set();
  let stop;
  const stream = {
    index,
    value,
    setValue(v) {
      stream.value = v;
      if (onChange) onChange(v);
    },
    listeners,
    observe(x) {
      if (listeners.size === 0) stop = run();
      listeners.add(x);
    },
    unobserve(x) {
      listeners.delete(x);
      if (listeners.size === 0 && stop) {
        stop();
        stop = null;
      }
    },
    update: null,
  };
  return stream;
};

export const createProcess = () => {
  let queue: any = null;

  const runNext = () => {
    if (queue.size > 0) {
      const next = [...queue].sort((a, b) =>
        sortMultiple(a.index, b.index, (x, y) => x - y),
      )[0];
      queue.delete(next);
      next.update();
      runNext();
    } else {
      queue = null;
    }
  };

  const updateStream = (stream, value) => {
    const first = !queue;
    stream.setValue(value);
    queue = new Set(
      [...(queue || []), ...stream.listeners].filter(x => x.index),
    );
    if (first) setTimeout(runNext);
  };

  return (index, value, onChange?) => {
    const stream = createStreamBase(index, null, onChange, () => {
      const active = new Set();
      const { initial, update, stop } = value({
        get(s) {
          active.add(s);
          s.observe(stream);
          return s.value;
        },
        stop(s) {
          active.delete(s);
          s.unobserve(stream);
        },
        output(v) {
          updateStream(stream, v);
        },
      });
      stream.value = initial;
      stream.update = update;
      return () => {
        for (const s of active.values()) s.unobserve(stream);
        if (stop) stop();
      };
    });
    return { type: 'stream', value: stream };
  };
};

export const createIndexer = (base = [] as number[]) => {
  let index = 0;
  return () => [...base, index++];
};

export const watchStreams = (create, indexer, streams, output) => {
  const results = streams.map((s, i) =>
    create(
      indexer(),
      ({ get, output }) => {
        const run = () => resolve(s, get, true);
        return { initial: run(), update: () => output(run()) };
      },
      data => output(i, data),
    ),
  );
  const obj = {};
  results.forEach(r => r.value.observe(obj));
  return {
    initial: results.map(r => r.value.value),
    stop: () => results.forEach(r => r.value.unobserve(obj)),
  };
};
