import { sortMultiple } from './data';

const obj = {};

export default () => {
  let queue: any = null;

  class Stream {
    listeners = new Set<any>();
    index;
    value;
    start;
    update;
    stop;

    constructor(index, run, onChange) {
      this.index = index;
      this.start = () => {
        let active = new Set<any>();
        const creator = new Creator(index);
        const { initial, update, stop } = run({
          get: s => {
            active.add(s);
            s.observe(this);
            return s.value;
          },
          output: v => {
            this.value = v;
            if (onChange) onChange(v);
            const first = !queue;
            queue = queue || new Set();
            for (const s of this.listeners) {
              if (s.index) queue.add(s);
            }
            if (first) setTimeout(runNext);
          },
          create: (...args) => (creator.create as any)(...args),
        });
        this.value = initial;
        this.update = () => {
          const prevActive = active;
          active = new Set();
          creator.reset();
          if (update) update();
          for (const s of prevActive) {
            if (!active.has(s)) s.unobserve(this);
          }
        };
        this.stop = () => {
          if (queue && queue.has(this)) queue.delete(this);
          for (const s of active.values()) s.unobserve(this);
          active = new Set();
          if (stop) stop();
        };
      };
    }

    observe(x = obj) {
      if (this.listeners.size === 0) this.start();
      this.listeners.add(x);
    }
    unobserve(x = obj) {
      if (this.listeners.has(x)) {
        this.listeners.delete(x);
        if (this.listeners.size === 0) this.stop();
      }
    }
    cancel() {
      if (this.listeners.size > 0) {
        this.listeners = new Set();
        this.stop();
      }
    }
  }

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

  class Creator {
    base;
    counter = 0;
    constructor(base) {
      this.base = base;
    }
    create(run, onChange?, forceIndex?) {
      const index = forceIndex || [...this.base, this.counter++];
      return new Stream(index, run, onChange) as any;
    }
    reset() {
      this.counter = 0;
    }
  }

  const result = new Creator([]) as any;
  return (...args) => result.create(...args);
};
