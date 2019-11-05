import maraca from '../src/index';

import config from './config';

const testStream = (code, values, done) => {
  let c = 0;
  const stop = maraca(code, config, data => {
    expect(data).toEqual(values[c]);
    if (!values[++c]) {
      stop();
      done();
    }
  });
};

test('basic', done => {
  testStream(
    '@1',
    [{ type: 'value', value: '1' }, { type: 'value', value: '2' }],
    done,
  );

  expect(maraca('#size.[1, 2, 3]', config)).toEqual({
    type: 'value',
    value: '3',
  });

  testStream(
    '@1 | 10',
    [{ type: 'value', value: '10' }, { type: 'value', value: '10' }],
    done,
  );

  testStream(
    '[x: 10, @1 | x? + 10 -> x?].x',
    [
      { type: 'value', value: '10', set: expect.any(Function) },
      { type: 'value', value: '20', set: expect.any(Function) },
    ],
    done,
  );
});
