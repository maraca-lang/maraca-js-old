import maraca, { fromJs } from '../src/index';

const testStream = (code, actions, values, done) => {
  let c = 0;
  const stop = maraca(code, data => {
    if (actions[c]) actions[c](data);
    if (values[c]) expect(data).toEqual(values[c]);
    if (!values[++c]) {
      stop();
      done();
    }
  });
};

test('basic', done => {
  testStream(
    '[x: 1]',
    [data => data.value[0].value.set(fromJs(2))],
    [
      {
        type: 'list',
        value: [
          {
            key: { type: 'value', value: 'x' },
            value: { type: 'value', value: '1', set: expect.any(Function) },
          },
        ],
      },
      {
        type: 'list',
        value: [
          {
            key: { type: 'value', value: 'x' },
            value: {
              type: 'value',
              value: '2',
              set: expect.any(Function),
              wasSet: true,
            },
          },
        ],
      },
    ],
    done,
  );
});
