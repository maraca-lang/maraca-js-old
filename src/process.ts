import { fromValue } from './data';
import listUtils from './list';
import { sortMultiple } from './utils';

const resolve = (data, get, deep, asData) => {
  if (data.type === 'stream') {
    return resolve(get(data.value), get, deep, asData);
  }
  if (!deep || data.type !== 'list') return data;
  const result = listUtils.map(data, value =>
    resolve(value, get, deep, asData),
  );
  return asData ? fromValue(result) : result;
};

const createStream = (index, value, run) => {
  let stop;
  const stream = {
    index,
    value,
    listeners: new Set(),
    observe(x) {
      if (stream.listeners.size === 0) stop = run();
      stream.listeners.add(x);
    },
    unobserve(x) {
      if (stream.listeners.has(x)) {
        stream.listeners.delete(x);
        if (stream.listeners.size === 0) stop();
      }
    },
    update: null as any,
    stop: () => {
      if (stream.listeners.size > 0) {
        stream.listeners = new Set();
        stop();
      }
    },
  };
  return stream;
};

export default () => {
  let queue: any = null;

  const runNext = () => {
    if (queue.size > 0) {
      const next = [...queue].sort((a, b) =>
        sortMultiple(a.index, b.index, (x, y) => x - y, true),
      )[0];
      queue.delete(next);
      next.update();
      runNext();
    } else {
      queue = null;
    }
  };

  const create = (index, run, onChange?) => {
    const stream = createStream(index, null, () => {
      let active = new Set();
      const get = s => {
        active.add(s);
        s.observe(stream);
        return s.value;
      };
      const { initial, update, stop } = run({
        get: (s, deep = false, asData = false) => resolve(s, get, deep, asData),
        output: v => {
          stream.value = v;
          if (onChange) onChange(v);
          const first = !queue;
          queue = queue || new Set();
          for (const s of stream.listeners) {
            if (s.index) queue.add(s);
          }
          if (first) setTimeout(runNext);
        },
        create: buildCreate(index),
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
        if (queue.has(stream)) queue.delete(stream);
        for (const s of active.values()) s.unobserve(stream);
        active = new Set();
        if (stop) stop();
      };
    });
    return { type: 'stream', value: stream };
  };

  const buildCreate = base => {
    let counter = 0;
    return (run?, onChange?) => {
      if (!run) {
        counter = 0;
      } else {
        const index = [...base, counter++];
        return create(index, run, onChange);
      }
    };
  };

  return buildCreate([]);
};
