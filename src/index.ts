import build from './build';
import parse from './parse';
import process from './process';

export default (script, initial, output) => {
  output(
    process(
      {
        initial: [initial],
        output: (_, next) => output(next),
      },
      queue => [build(queue, { scope: [0], current: [0] }, parse(script))],
    ).initial[0],
  );
};
