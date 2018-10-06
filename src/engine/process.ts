export default ({ initial, output }, build) => {
  const steps = [] as any;
  let active = { changed: {}, queue: [] } as any;
  const queueItem = (index, next, changed) => {
    if (index === result) {
      output(next);
      active = { changed: {}, queue: [] };
    } else {
      steps[index].current = next;
      active.changed[index] = changed;
      steps[index].listeners.forEach(i => {
        if (!active.queue.includes(i)) {
          active.queue.push(i);
          active.queue.sort((a, b) => a - b);
        }
      });
    }
  };
  const runNext = () => {
    if (active.queue.length > 0) {
      const next = active.queue.shift();
      steps[next].update();
      runNext();
    } else {
      active = { changed: {}, queue: [] };
    }
  };
  const queueStream = (args, stream) => {
    const index = steps.length;
    const { initial, input } = stream({
      initial: args.map(a => steps[a].current),
      output: (next, changed = true) => {
        const first = active.queue.length === 0;
        queueItem(index, next, changed);
        if (first) runNext();
      },
    });
    steps.push({
      args,
      current: initial,
      update: () =>
        input(
          args.map(a => ({
            value: steps[a].current,
            changed: active.changed[a],
          })),
        ),
      listeners: [],
    });
    args.forEach(a => steps[a].listeners.push(index));
    return index;
  };
  queueStream([], () => ({ initial }));
  const result = build(queueStream);
  return {
    initial: steps[result].current,
    input: (next, changed = true) => {
      queueItem(0, next, changed);
      runNext();
    },
  };
};
