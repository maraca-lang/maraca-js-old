import maraca from '../src/index';
import List from '../src/list';

test('basic', () => {
  expect(maraca('[[a, b, x: c]: [1, 2, x: 3]]')).toEqual({
    type: 'list',
    value: List.fromPairs([
      {
        key: { type: 'value', value: 'a' },
        value: { type: 'value', value: '1' },
      },
      {
        key: { type: 'value', value: 'b' },
        value: { type: 'value', value: '2' },
      },
      {
        key: { type: 'value', value: 'c', set: expect.any(Function) },
        value: { type: 'value', value: '3', set: expect.any(Function) },
      },
    ] as any),
  });
  expect(maraca('[[_, _, a]: [1, 2, 3]]')).toEqual({
    type: 'list',
    value: List.fromPairs([
      {
        key: { type: 'value', value: ' ' },
        value: { type: 'value', value: '2' },
      },
      {
        key: { type: 'value', value: 'a' },
        value: { type: 'value', value: '3' },
      },
    ] as any),
  });
});

test('partial', () => {
  expect(maraca('[[x, y]: [1, 2, 3]]')).toEqual({
    type: 'list',
    value: List.fromPairs([
      {
        key: { type: 'value', value: 'x' },
        value: { type: 'value', value: '1' },
      },
      {
        key: { type: 'value', value: 'y' },
        value: { type: 'value', value: '2' },
      },
    ] as any),
  });
  expect(maraca('[[a, => b]: [1, 2, 3]]')).toEqual({
    type: 'list',
    value: List.fromPairs([
      {
        key: { type: 'value', value: 'a' },
        value: { type: 'value', value: '1' },
      },
      {
        key: { type: 'value', value: 'b' },
        value: {
          type: 'list',
          value: List.fromPairs([
            {
              key: { type: 'value', value: '1' },
              value: { type: 'value', value: '2' },
            },
            {
              key: { type: 'value', value: '2' },
              value: { type: 'value', value: '3' },
            },
          ] as any),
        },
      },
    ] as any),
  });
  expect(maraca('[[a:=, b:=]: [a: 1, b: 2, c: 3, d: 4]]')).toEqual({
    type: 'list',
    value: List.fromPairs([
      {
        key: { type: 'value', value: 'a', set: expect.any(Function) },
        value: { type: 'value', value: '1', set: expect.any(Function) },
      },
      {
        key: { type: 'value', value: 'b', set: expect.any(Function) },
        value: { type: 'value', value: '2', set: expect.any(Function) },
      },
    ] as any),
  });
});

test('unpack', () => {
  expect(maraca('[:[a], a]')).toEqual({
    type: 'list',
    value: List.fromPairs([
      {
        key: { type: 'value', value: '1' },
        value: { type: 'value', value: 'a' },
      },
      {
        key: { type: 'value', value: '2' },
        value: { type: 'value', value: 'a' },
      },
    ] as any),
  });
  expect(maraca('[x: 1, : [y: 2, z: 3]]')).toEqual({
    type: 'list',
    value: List.fromPairs([
      {
        key: { type: 'value', value: 'x' },
        value: { type: 'value', value: '1', set: expect.any(Function) },
      },
      {
        key: { type: 'value', value: 'y' },
        value: { type: 'value', value: '2', set: expect.any(Function) },
      },
      {
        key: { type: 'value', value: 'z' },
        value: { type: 'value', value: '3', set: expect.any(Function) },
      },
    ] as any),
  });
  expect(maraca('[1, 2, : [3, 4]]')).toEqual({
    type: 'list',
    value: List.fromPairs([
      {
        key: { type: 'value', value: '1' },
        value: { type: 'value', value: '1' },
      },
      {
        key: { type: 'value', value: '2' },
        value: { type: 'value', value: '2' },
      },
      {
        key: { type: 'value', value: '3' },
        value: { type: 'value', value: '3' },
      },
      {
        key: { type: 'value', value: '4' },
        value: { type: 'value', value: '4' },
      },
    ] as any),
  });
});
