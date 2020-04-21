import maraca from '../src/index';
import Block from '../src/block';

test('basic', () => {
  expect(maraca('[x: a, y: x?]')).toEqual({
    type: 'block',
    value: Block.fromPairs([
      {
        key: { type: 'value', value: 'x' },
        value: { type: 'value', value: 'a' },
      },
      {
        key: { type: 'value', value: 'y' },
        value: { type: 'value', value: 'a' },
      },
    ] as any),
  });
});

test('order', () => {
  expect(maraca('[x: a, y: z?, z: b]')).toEqual({
    type: 'block',
    value: Block.fromPairs([
      {
        key: { type: 'value', value: 'x' },
        value: { type: 'value', value: 'a' },
      },
      {
        key: { type: 'value', value: 'y' },
        value: { type: 'value', value: '' },
      },
      {
        key: { type: 'value', value: 'z' },
        value: { type: 'value', value: 'b' },
      },
    ] as any),
  });
});

test('nested', () => {
  expect(maraca('[x: a, y: [x?]]')).toEqual({
    type: 'block',
    value: Block.fromPairs([
      {
        key: { type: 'value', value: 'x' },
        value: { type: 'value', value: 'a' },
      },
      {
        key: { type: 'value', value: 'y' },
        value: {
          type: 'block',
          value: Block.fromPairs([
            {
              key: { type: 'value', value: '1' },
              value: { type: 'value', value: 'a' },
            },
          ] as any),
        },
      },
    ] as any),
  });
  expect(maraca('[a, [1?]]')).toEqual({
    type: 'block',
    value: Block.fromPairs([
      {
        key: { type: 'value', value: '1' },
        value: { type: 'value', value: 'a' },
      },
      {
        key: { type: 'value', value: '2' },
        value: { type: 'block', value: new Block() },
      },
    ] as any),
  });
  expect(maraca('[[x: a], x?]')).toEqual({
    type: 'block',
    value: Block.fromPairs([
      {
        key: { type: 'value', value: '1' },
        value: {
          type: 'block',
          value: Block.fromPairs([
            {
              key: { type: 'value', value: 'x' },
              value: { type: 'value', value: 'a' },
            },
          ] as any),
        },
      },
    ] as any),
  });
});

test('shorthand', () => {
  expect(maraca('[x: 1, y: [x:=?]]')).toEqual({
    type: 'block',
    value: Block.fromPairs([
      {
        key: { type: 'value', value: 'x' },
        value: { type: 'value', value: '1' },
      },
      {
        key: { type: 'value', value: 'y' },
        value: {
          type: 'block',
          value: Block.fromPairs([
            {
              key: { type: 'value', value: 'x' },
              value: { type: 'value', value: '1' },
            },
          ] as any),
        },
      },
    ] as any),
  });
});
