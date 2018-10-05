export default ({ initial, output }, build) => {
  const steps = [] as any;
  let active = { changed: {}, queue: [] } as any;
  const run = (index, next) => {
    if (index === result) {
      output(next);
      active = { changed: {}, queue: [] };
    } else {
      steps[index].current = next;
      active.changed[index] = true;
      steps[index].listeners.forEach(i => {
        if (!active.queue.includes(i)) {
          active.queue.push(i);
          active.queue.sort((a, b) => a - b);
        }
      });
      if (active.queue.length > 0) {
        const next = active.queue.shift();
        steps[next].update();
      } else {
        active = { changed: {}, queue: [] };
      }
    }
  };
  const queue = (args, stream) => {
    const index = steps.length;
    const { initial, input } = stream({
      initial: args.map(a => steps[a].current),
      output: next => run(index, next),
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
  queue([], () => ({ initial }));
  const result = build(queue);
  return {
    initial: steps[result].current,
    input: next => run(0, next),
  };
};
