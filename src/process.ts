import { sortMultiple } from './data';
import listUtils from './list';

const createStream = (index, run) => {
  let stop;
  const stream = {
    index,
    value: null,
    listeners: new Set<any>(),
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
    const stream = createStream(index, () => {
      let active = new Set<any>();
      let prevValues = new Map<any, any>();
      let nextValues = new Map<any, any>();
      const resolve = (data, deep) => {
        if (!deep) {
          if (data.type === 'stream') {
            active.add(data.value);
            data.value.observe(stream);
            return resolve(data.value.value, false);
          }
          return { value: data, changed: false };
        }

        if (data.type === 'stream') {
          active.add(data.value);
          data.value.observe(stream);
          const res = resolve(data.value.value, true);
          nextValues.set(data, res.value);
          return {
            value: res.value,
            changed:
              !prevValues.has(data) || prevValues.get(data) !== res.value,
          };
        }
        if (data.type !== 'list') return { value: data, changed: false };
        let changed = false;
        const value = listUtils.map(data, value => {
          const r = resolve(value, true);
          if (r.changed) changed = true;
          return r.value;
        });
        const result =
          !changed && prevValues.has(data) ? prevValues.get(data) : value;
        nextValues.set(data, result);
        return { value: result, changed };
      };
      const { initial, update, stop } = run({
        get: (s, deep = false) => resolve(s, deep).value,
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
        prevValues = nextValues;
        nextValues = new Map<any, any>();
        if (update) update();
        for (const s of prevActive) {
          if (!active.has(s)) s.unobserve(stream);
        }
      };
      return () => {
        if (queue && queue.has(stream)) queue.delete(stream);
        for (const s of active.values()) s.unobserve(stream);
        active = new Set();
        if (stop) stop();
      };
    });
    return { type: 'stream', value: stream };
  };

  const buildCreate = base => {
    let counter = 0;
    return (run?, onChange?, forceIndex?) => {
      if (!run) {
        counter = 0;
      } else {
        const index = forceIndex || [...base, counter++];
        return create(index, run, onChange);
      }
    };
  };

  return buildCreate([]);
};
