import maraca from '../src/index';
import List from '../src/list';

test('basic', () => {
  expect(maraca('[x: a, y: x?]')).toEqual({
    type: 'list',
    value: List.fromPairs([
      {
        key: { type: 'value', value: 'x' },
        value: { type: 'value', value: 'a', push: expect.any(Function) },
      },
      {
        key: { type: 'value', value: 'y' },
        value: { type: 'value', value: 'a', push: expect.any(Function) },
      },
    ] as any),
  });
});

test('order', () => {
  expect(maraca('[x: a, y: z?, z: b]')).toEqual({
    type: 'list',
    value: List.fromPairs([
      {
        key: { type: 'value', value: 'x' },
        value: { type: 'value', value: 'a', push: expect.any(Function) },
      },
      {
        key: { type: 'value', value: 'y' },
        value: { type: 'value', value: '', push: expect.any(Function) },
      },
      {
        key: { type: 'value', value: 'z' },
        value: { type: 'value', value: 'b', push: expect.any(Function) },
      },
    ] as any),
  });
});

test('nested', () => {
  expect(maraca('[x: a, y: [x?]]')).toEqual({
    type: 'list',
    value: List.fromPairs([
      {
        key: { type: 'value', value: 'x' },
        value: { type: 'value', value: 'a', push: expect.any(Function) },
      },
      {
        key: { type: 'value', value: 'y' },
        value: {
          type: 'list',
          value: List.fromPairs([
            {
              key: { type: 'value', value: '1' },
              value: { type: 'value', value: 'a', push: expect.any(Function) },
            },
          ] as any),
        },
      },
    ] as any),
  });
  expect(maraca('[a, [1?]]')).toEqual({
    type: 'list',
    value: List.fromPairs([
      {
        key: { type: 'value', value: '1' },
        value: { type: 'value', value: 'a' },
      },
      {
        key: { type: 'value', value: '2' },
        value: { type: 'list', value: new List() },
      },
    ] as any),
  });
  expect(maraca('[[x: a], x?]')).toEqual({
    type: 'list',
    value: List.fromPairs([
      {
        key: { type: 'value', value: '1' },
        value: {
          type: 'list',
          value: List.fromPairs([
            {
              key: { type: 'value', value: 'x' },
              value: { type: 'value', value: 'a', push: expect.any(Function) },
            },
          ] as any),
        },
      },
      {
        key: { type: 'value', value: 'x' },
        value: { type: 'value', value: '', push: expect.any(Function) },
      },
    ] as any),
  });
});

test('shorthand', () => {
  expect(maraca('[x: 1, y: [x:=?]]')).toEqual({
    type: 'list',
    value: List.fromPairs([
      {
        key: { type: 'value', value: 'x' },
        value: { type: 'value', value: '1', push: expect.any(Function) },
      },
      {
        key: { type: 'value', value: 'y' },
        value: {
          type: 'list',
          value: List.fromPairs([
            {
              key: { type: 'value', value: 'x' },
              value: { type: 'value', value: '1', push: expect.any(Function) },
            },
          ] as any),
        },
      },
    ] as any),
  });
});
