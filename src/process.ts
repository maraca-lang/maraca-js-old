export default ({ initial, output }, build) => {
  const streams: any = [];
  const actions: any = [];
  let active: any = null;
  const updateStream = (index, value, changed = true) => {
    let first = !active;
    if (first) active = { queue: [], changed: [] };
    const i = result.indexOf(index);
    if (i !== -1) output(i, value, changed);
    streams[index].value = value;
    active.changed[index] = changed;
    streams[index].listeners.forEach(i => {
      if (!active.queue.includes(i)) {
        active.queue.push(i);
        active.queue.sort((a, b) => a - b);
      }
    });
    if (first) runNext();
  };
  const runNext = () => {
    if (active.queue.length > 0) {
      const next = active.queue.shift();
      actions[next]();
      runNext();
    } else {
      active = null;
    }
  };
  const queueAction = (args, action) => {
    args.forEach(i => streams[i].listeners.push(actions.length));
    const { initial, input } = action({
      initial: args.map(i => streams[i].value),
      output: (index, value, changed) => {
        updateStream(indices[index], value, changed);
      },
    });
    const indices = initial.map((_, i) => streams.length + i);
    actions.push(() => {
      const updates = args
        .map((index, i) => [i, streams[index].value, active.changed[index]])
        .filter(u => u[2]);
      if (updates.length > 0) input(updates);
    });
    initial.forEach(value => streams.push({ value, listeners: [] }));
    return indices;
  };
  initial.forEach(value => streams.push({ value, listeners: [] }));
  const result = build(queueAction);
  return {
    initial: result.map(i => streams[i].value),
    input: updates => {
      if (updates) {
        updates.forEach(u => (updateStream as any)(...u));
      }
    },
  };
};
