import maraca from '../src/index';
import { fromJs } from '../src/data';
import List from '../src/list';

const testStream = (code, actions, values, done) => {
  let c = 0;
  const stop = maraca(code, data => {
    if (actions[c]) actions[c](data);
    if (values[c]) expect(data).toEqual(values[c]);
    if (!values[++c]) {
      setTimeout(() => stop());
      done();
    }
  });
};

test('basic', done => {
  testStream(
    '[x: 1]',
    [data => data.value.get(fromJs('x')).push(fromJs(2))],
    [
      {
        type: 'list',
        value: List.fromPairs([
          {
            key: { type: 'value', value: 'x' },
            value: { type: 'value', value: '1', push: expect.any(Function) },
          },
        ] as any),
      },
      {
        type: 'list',
        value: List.fromPairs([
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

test('auto', () => {
  expect(maraca('[x?]')).toEqual({
    type: 'list',
    value: List.fromPairs([
      {
        key: { type: 'value', value: 'x' },
        value: { type: 'value', value: '', push: expect.any(Function) },
      },
    ] as any),
  });

  expect(maraca('[(x?)]')).toEqual({
    type: 'list',
    value: List.fromPairs([
      {
        key: { type: 'value', value: 'x' },
        value: { type: 'value', value: '', push: expect.any(Function) },
      },
    ] as any),
  });
});

test('auto assign', done => {
  testStream(
    '[y: x?]',
    [data => data.value.get(fromJs('x')).push(fromJs('a'))],
    [
      {
        type: 'list',
        value: List.fromPairs([
          {
            key: { type: 'value', value: 'x' },
            value: { type: 'value', value: '', push: expect.any(Function) },
          },
          {
            key: { type: 'value', value: 'y' },
            value: { type: 'value', value: '', push: expect.any(Function) },
          },
        ] as any),
      },
      {
        type: 'list',
        value: List.fromPairs([
          {
            key: { type: 'value', value: 'x' },
            value: {
              type: 'value',
              value: 'a',
              push: expect.any(Function),
            },
          },
          {
            key: { type: 'value', value: 'y' },
            value: {
              type: 'value',
              value: 'a',
              push: expect.any(Function),
            },
          },
        ] as any),
      },
    ],
    done,
  );
});

test('auto assign 2', done => {
  testStream(
    '[y: (x?, 10)]',
    [data => data.value.get(fromJs('x')).push(fromJs('a'))],
    [
      {
        type: 'list',
        value: List.fromPairs([
          {
            key: { type: 'value', value: 'x' },
            value: { type: 'value', value: '', push: expect.any(Function) },
          },
          {
            key: { type: 'value', value: 'y' },
            value: { type: 'value', value: '', push: expect.any(Function) },
          },
        ] as any),
      },
      {
        type: 'list',
        value: List.fromPairs([
          {
            key: { type: 'value', value: 'x' },
            value: {
              type: 'value',
              value: 'a',
              push: expect.any(Function),
            },
          },
          {
            key: { type: 'value', value: 'y' },
            value: {
              type: 'value',
              value: '10',
              push: expect.any(Function),
            },
          },
        ] as any),
      },
    ],
    done,
  );
});
