import { resolve, sortMultiple } from './data';

export const createIndexer = (base = [] as number[]) => {
  let index = 0;
  return () => [...base, index++];
};

const createStream = (index, value, onChange, run) => {
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
    update: null as any,
  };
  return stream;
};

export default () => {
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
    const stream = createStream(index, null, onChange, () => {
      let active = new Set();
      const get = s => {
        active.add(s);
        s.observe(stream);
        return s.value;
      };
      const { initial, update, stop } = value({
        get: (s, deep = false) => resolve(s, get, deep),
        output: v => updateStream(stream, v),
      });
      stream.value = initial;
      stream.update = () => {
        const prevActive = active;
        active = new Set();
        update();
        for (const s of prevActive) {
          if (!active.has(s)) s.unobserve(stream);
        }
      };
      return () => {
        for (const s of active.values()) s.unobserve(stream);
        if (stop) stop();
      };
    });
    return { type: 'stream', value: stream };
  };
};
