import maraca, { fromJs } from '../src/index';

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
            },
          },
        ],
      },
    ],
    done,
  );
});

test('auto', () => {
  expect(maraca('[x?]')).toEqual({
    type: 'list',
    value: [
      {
        key: { type: 'value', value: 'x' },
        value: { type: 'value', value: '', set: expect.any(Function) },
      },
    ],
  });

  expect(maraca('[(x?)]')).toEqual({
    type: 'list',
    value: [
      {
        key: { type: 'value', value: 'x' },
        value: { type: 'value', value: '', set: expect.any(Function) },
      },
    ],
  });
});

test('auto assign', done => {
  testStream(
    '[y: x?]',
    [data => data.value[0].value.set(fromJs('a'))],
    [
      {
        type: 'list',
        value: [
          {
            key: { type: 'value', value: 'x' },
            value: { type: 'value', value: '', set: expect.any(Function) },
          },
          {
            key: { type: 'value', value: 'y' },
            value: { type: 'value', value: '', set: expect.any(Function) },
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
              value: 'a',
              set: expect.any(Function),
            },
          },
          {
            key: { type: 'value', value: 'y' },
            value: {
              type: 'value',
              value: 'a',
              set: expect.any(Function),
            },
          },
        ],
      },
    ],
    done,
  );
});

test('auto assign 2', done => {
  testStream(
    '[y: (x?, 10)]',
    [data => data.value[0].value.set(fromJs('a'))],
    [
      {
        type: 'list',
        value: [
          {
            key: { type: 'value', value: 'x' },
            value: { type: 'value', value: '', set: expect.any(Function) },
          },
          {
            key: { type: 'value', value: 'y' },
            value: { type: 'value', value: '', set: expect.any(Function) },
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
              value: 'a',
              set: expect.any(Function),
            },
          },
          {
            key: { type: 'value', value: 'y' },
            value: {
              type: 'value',
              value: '10',
              set: expect.any(Function),
            },
          },
        ],
      },
    ],
    done,
  );
});
