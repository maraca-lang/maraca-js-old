import maraca from '../src/index';

test('basic', () => {
  expect(maraca('[x: a, y: x?]')).toEqual({
    type: 'list',
    value: [
      {
        key: { type: 'value', value: 'x' },
        value: { type: 'value', value: 'a', set: expect.any(Function) },
      },
      {
        key: { type: 'value', value: 'y' },
        value: { type: 'value', value: 'a', set: expect.any(Function) },
      },
    ],
  });
});

test('order', () => {
  expect(maraca('[x: a, y: z?, z: b]')).toEqual({
    type: 'list',
    value: [
      {
        key: { type: 'value', value: 'x' },
        value: { type: 'value', value: 'a', set: expect.any(Function) },
      },
      {
        key: { type: 'value', value: 'y' },
        value: { type: 'value', value: '', set: expect.any(Function) },
      },
      {
        key: { type: 'value', value: 'z' },
        value: { type: 'value', value: 'b', set: expect.any(Function) },
      },
    ],
  });
});

test('nested', () => {
  expect(maraca('[x: a, y: [x?]]')).toEqual({
    type: 'list',
    value: [
      {
        key: { type: 'value', value: 'x' },
        value: { type: 'value', value: 'a', set: expect.any(Function) },
      },
      {
        key: { type: 'value', value: 'y' },
        value: {
          type: 'list',
          value: [
            {
              key: { type: 'value', value: '1' },
              value: { type: 'value', value: 'a', set: expect.any(Function) },
            },
          ],
          set: expect.any(Function),
        },
      },
    ],
  });
  expect(maraca('[a, [1?]]')).toEqual({
    type: 'list',
    value: [
      {
        key: { type: 'value', value: '1' },
        value: { type: 'value', value: 'a' },
      },
      {
        key: { type: 'value', value: '2' },
        value: { type: 'list', value: [] },
      },
    ],
  });
  expect(maraca('[[x: a], x?]')).toEqual({
    type: 'list',
    value: [
      {
        key: { type: 'value', value: '1' },
        value: {
          type: 'list',
          value: [
            {
              key: { type: 'value', value: 'x' },
              value: { type: 'value', value: 'a', set: expect.any(Function) },
            },
          ],
        },
      },
      {
        key: { type: 'value', value: 'x' },
        value: { type: 'value', value: '', set: expect.any(Function) },
      },
    ],
  });
});

test('shorthand', () => {
  expect(maraca('[x: 1, y: [x:=?]]')).toEqual({
    type: 'list',
    value: [
      {
        key: { type: 'value', value: 'x' },
        value: { type: 'value', value: '1', set: expect.any(Function) },
      },
      {
        key: { type: 'value', value: 'y' },
        value: {
          type: 'list',
          value: [
            {
              key: { type: 'value', value: 'x' },
              value: { type: 'value', value: '1', set: expect.any(Function) },
            },
          ],
          set: expect.any(Function),
        },
      },
    ],
  });
});
