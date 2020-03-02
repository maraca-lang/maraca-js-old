import maraca from '../src/index';
import Box from '../src/box';

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

test('interpret', done => {
  testStream(
    '@1',
    [
      { type: 'value', value: '1' },
      { type: 'value', value: '2' },
    ],
    done,
  );
});

test('lib', () => {
  expect(maraca('#[1, 2, 3]', config)).toEqual({
    type: 'value',
    value: '3',
  });
  expect(maraca('#size.[1, 2, 3]', config)).toEqual({
    type: 'value',
    value: '3',
  });
});

test('trigger', done => {
  testStream(
    '@1 | 10',
    [
      { type: 'value', value: '10' },
      { type: 'value', value: '10' },
    ],
    done,
  );
});

test('push', done => {
  testStream(
    '[x: 10, @1 | x? + 10 -> x?].x',
    [
      { type: 'value', value: '10', push: expect.any(Function) },
      { type: 'value', value: '20', push: expect.any(Function) },
    ],
    done,
  );
});

test('push box', done => {
  testStream(
    '[x: [a], @1 | [: x?, a] -> x?].x',
    [
      {
        type: 'box',
        value: Box.fromPairs([
          {
            key: { type: 'value', value: '1' },
            value: { type: 'value', value: 'a' },
          },
        ] as any),
      },
      {
        type: 'box',
        value: Box.fromPairs([
          {
            key: { type: 'value', value: '1' },
            value: { type: 'value', value: 'a' },
          },
          {
            key: { type: 'value', value: '2' },
            value: { type: 'value', value: 'a' },
          },
        ] as any),
      },
    ],
    done,
  );
});
