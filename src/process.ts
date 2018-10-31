import { resolveDeep } from './data';

export default ({ values, output }, build) => {
  const streams: any = values.map((value, index) => ({
    current: value,
    listeners: {},
    listen: listenIndex => {
      streams[index].listeners[listenIndex] = true;
    },
    unlisten: listenIndex => {
      delete streams[index].listeners[listenIndex];
    },
    stop: () => {},
  }));
  const actions: any = [];
  let queue: any = null;

  const updateStream = (index, value) => {
    const first = !queue;
    if (first) queue = {};
    const i = result.indexOf(index);
    if (i !== -1) output(i, value);
    streams[index].current = value;
    Object.keys(streams[index].listeners).forEach(i => i && (queue[i] = true));
    if (first) runNext();
  };

  const runNext = () => {
    const next = Object.keys(queue)
      .map(k => parseFloat(k))
      .sort((a, b) => a - b)[0];
    if (next !== undefined) {
      delete queue[next];
      actions[next]();
      runNext();
    } else {
      queue = null;
    }
  };

  const addAction = (count, action) => {
    const actionIndex = actions.length;
    let actionInput;
    let actionStop;
    actions.push(() => actionInput());
    const indices = Array.from({ length: count }).map(
      (_, i) => streams.length + i,
    );
    indices.forEach(index =>
      streams.push({
        current: null,
        listeners: {},
        listen: listenIndex => {
          if (Object.keys(streams[index].listeners).length === 0) {
            const live = {};
            const { initial, input, stop } = action({
              get: streamIndex => {
                live[streamIndex] = true;
                streams[streamIndex].listen(actionIndex);
                return streams[streamIndex].current;
              },
              stop: streamIndex => {
                delete live[streamIndex];
                streams[streamIndex].unlisten(actionIndex);
              },
              output: (i, v) => updateStream(indices[i], v),
            });
            initial.forEach((v, i) => (streams[indices[i]].current = v));
            actionInput = input;
            actionStop = () => {
              Object.keys(live).forEach(streamIndex => {
                delete live[streamIndex];
                streams[streamIndex].unlisten(actionIndex);
              });
              if (stop) stop();
            };
          }
          streams[index].listeners[listenIndex || ''] = true;
        },
        unlisten: listenIndex => {
          delete streams[index].listeners[listenIndex || ''];
          if (Object.keys(streams[index].listeners).length === 0) {
            if (actionStop) actionStop();
            actionInput = null;
            actionStop = null;
          }
        },
      }),
    );
    return indices;
  };

  const result = build(addAction).map(
    index =>
      addAction(1, ({ get, output }) => {
        const run = () => resolveDeep(get(index), get);
        return { initial: [run()], input: () => output(0, run()) };
      })[0],
  );

  result.map(i => streams[i].listen());
  return {
    initial: result.map(i => streams[i].current),
    input: (index, value) => updateStream(index, value),
    stop: () => result.map(i => streams[i].unlisten()),
  };
};
