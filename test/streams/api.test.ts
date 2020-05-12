import maraca from '../../src/index';
import { fromPairs } from '../../src/utils/block';
import { fromJs } from '../../src/utils/data';

const testStream = (code, actions, values, done) => {
  let c = 0;
  const stop = maraca(code, (data) => {
    if (actions[c]) actions[c](data);
    if (values[c]) expect(data).toEqual(values[c]);
    if (!values[++c]) {
      setTimeout(() => stop());
      done();
    }
  });
};

test('basic', (done) => {
  testStream(
    '[x:~ 1]',
    [(data) => data.value.values.x.value.push(fromJs(2))],
    [
      {
        type: 'block',
        value: fromPairs([
          {
            key: { type: 'value', value: 'x' },
            value: { type: 'value', value: '1', push: expect.any(Function) },
          },
        ] as any),
      },
      {
        type: 'block',
        value: fromPairs([
          {
            key: { type: 'value', value: 'x' },
            value: {
              type: 'value',
              value: '2',
              push: expect.any(Function),
            },
          },
        ] as any),
      },
    ],
    done,
  );
});
