import maraca from '../src/index';
import Box from '../src/box';

test('basic', () => {
  expect(maraca('[x: a, y: x?]')).toEqual({
    type: 'box',
    value: Box.fromPairs([
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
    type: 'box',
    value: Box.fromPairs([
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
    type: 'box',
    value: Box.fromPairs([
      {
        key: { type: 'value', value: 'x' },
        value: { type: 'value', value: 'a', push: expect.any(Function) },
      },
      {
        key: { type: 'value', value: 'y' },
        value: {
          type: 'box',
          value: Box.fromPairs([
            {
              key: { type: 'value', value: '1' },
              value: { type: 'value', value: 'a', push: expect.any(Function) },
            },
          ] as any),
          push: expect.any(Function),
        },
      },
    ] as any),
  });
  expect(maraca('[a, [1?]]')).toEqual({
    type: 'box',
    value: Box.fromPairs([
      {
        key: { type: 'value', value: '1' },
        value: { type: 'value', value: 'a' },
      },
      {
        key: { type: 'value', value: '2' },
        value: { type: 'box', value: new Box() },
      },
    ] as any),
  });
  expect(maraca('[[x: a], x?]')).toEqual({
    type: 'box',
    value: Box.fromPairs([
      {
        key: { type: 'value', value: '1' },
        value: {
          type: 'box',
          value: Box.fromPairs([
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
    type: 'box',
    value: Box.fromPairs([
      {
        key: { type: 'value', value: 'x' },
        value: { type: 'value', value: '1', push: expect.any(Function) },
      },
      {
        key: { type: 'value', value: 'y' },
        value: {
          type: 'box',
          value: Box.fromPairs([
            {
              key: { type: 'value', value: 'x' },
              value: { type: 'value', value: '1', push: expect.any(Function) },
            },
          ] as any),
          push: expect.any(Function),
        },
      },
    ] as any),
  });
});
