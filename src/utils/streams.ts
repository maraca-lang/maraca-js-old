const obj = {};

const sortStreams = (streams) => {
  const result = [] as any[];
  const remaining = new Set([...streams]);
  const visit = (item) => {
    if (!remaining.has(item)) return;
    if (item.mark === true) throw new Error();
    item.mark = true;
    for (const l of item.listeners) if (streams.has(l)) visit(l);
    delete item.mark;
    remaining.delete(item);
    result.unshift(item);
  };
  while (remaining.size > 0) {
    const next = remaining.values().next().value;
    visit(next);
    remaining.delete(next);
  }
  return result;
};

class Queue {
  private queue: Set<Stream> | null = null;
  add(streams: Set<Stream>) {
    const first = !this.queue;
    if (first) this.queue = new Set();
    for (const s of streams) {
      if (s !== obj) this.queue!.add(s);
    }
    if (first) setTimeout(() => this.next());
  }
  remove(stream: Stream) {
    if (this.queue && this.queue.has(stream)) this.queue.delete(stream);
  }
  next() {
    if (this.queue && this.queue.size > 0) {
      const next = sortStreams(this.queue)[0];
      this.queue.delete(next);
      next.update();
      this.next();
    } else {
      this.queue = null;
    }
  }
}

export class Stream {
  listeners = new Set<any>();
  value = null;
  start;
  update;
  stop;
  onChange;

  constructor(queue, run) {
    this.start = () => {
      let active = new Set<any>();
      let firstUpdate = true;
      const update = run(
        (v) => {
          this.value = v;
          if (!firstUpdate) {
            if (this.onChange) this.onChange(v);
            queue.add(this.listeners);
          }
        },
        (s, snapshot) => {
          s.observe(this);
          if (!snapshot) active.add(s);
          return s.value;
        },
      );
      if (update) update();
      firstUpdate = false;
      this.update = () => {
        const prevActive = active;
        active = new Set();
        if (update) update();
        for (const s of prevActive) {
          if (!active.has(s)) s.unobserve(this);
        }
      };
      this.stop = () => {
        queue.remove(this);
        for (const s of active.values()) s.unobserve(this);
        active = new Set();
        if (update && update.length === 1) update(true);
      };
    };
  }

  observe(x?) {
    if (typeof x === 'function') this.onChange = x;
    if (this.listeners.size === 0) this.start();
    this.listeners.add(typeof x === 'function' ? obj : x);
  }
  unobserve(x = obj) {
    delete this.onChange;
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

class StaticStream {
  run;
  value = null;
  hasRun = false;
  constructor(run) {
    this.run = run;
  }
  get() {
    if (this.hasRun) return this.value;
    const update = this.run(
      (v) => {
        this.value = v;
      },
      (s) => s.get(),
      (run) => new StaticStream(run),
    );
    if (update) {
      update();
      if (update.length === 1) update(true);
    }
    this.hasRun = true;
    return this.value;
  }
}

export default (build, output?) => {
  if (!output) {
    return build((run) => new StaticStream(run)).get();
  }
  const queue = new Queue();
  const stream = build((run) => new Stream(queue, run));
  stream.observe(output);
  const first = stream.value;
  if (!output) {
    stream.unobserve();
    return first;
  }
  output(first);
  return () => stream.unobserve();
};
