import maraca from '../../src/index';
import Block from '../../src/block';

test('basic', () => {
  expect(maraca('[hello, world]')).toEqual({
    type: 'block',
    value: Block.fromPairs([
      {
        key: { type: 'value', value: '1' },
        value: { type: 'value', value: 'hello' },
      },
      {
        key: { type: 'value', value: '2' },
        value: { type: 'value', value: 'world' },
      },
    ] as any),
  });
  expect(maraca('[x: a, y: b]')).toEqual({
    type: 'block',
    value: Block.fromPairs([
      {
        key: { type: 'value', value: 'x' },
        value: { type: 'value', value: 'a' },
      },
      {
        key: { type: 'value', value: 'y' },
        value: { type: 'value', value: 'b' },
      },
    ] as any),
  });
  expect(maraca('[10, key: value]')).toEqual({
    type: 'block',
    value: Block.fromPairs([
      {
        key: { type: 'value', value: '1' },
        value: { type: 'value', value: '10' },
      },
      {
        key: { type: 'value', value: 'key' },
        value: { type: 'value', value: 'value' },
      },
    ] as any),
  });
});

test('nils ignored', () => {
  expect(maraca('[a, , b]')).toEqual({
    type: 'block',
    value: Block.fromPairs([
      {
        key: { type: 'value', value: '1' },
        value: { type: 'value', value: 'a' },
      },
      {
        key: { type: 'value', value: '2' },
        value: { type: 'value', value: 'b' },
      },
    ] as any),
  });
});

test('nested', () => {
  expect(maraca('[y: [a, b]]')).toEqual({
    type: 'block',
    value: Block.fromPairs([
      {
        key: { type: 'value', value: 'y' },
        value: {
          type: 'block',
          value: Block.fromPairs([
            {
              key: { type: 'value', value: '1' },
              value: { type: 'value', value: 'a' },
            },
            {
              key: { type: 'value', value: '2' },
              value: { type: 'value', value: 'b' },
            },
          ] as any),
        },
      },
    ] as any),
  });
  expect(maraca('[[a, b]: 100]')).toEqual({
    type: 'block',
    value: Block.fromPairs([
      {
        key: {
          type: 'block',
          value: Block.fromPairs([
            {
              key: { type: 'value', value: '1' },
              value: { type: 'value', value: 'a' },
            },
            {
              key: { type: 'value', value: '2' },
              value: { type: 'value', value: 'b' },
            },
          ] as any),
        },
        value: { type: 'value', value: '100' },
      },
    ] as any),
  });
});

test('sort', () => {
  expect(
    (maraca('[: 1, 2, 3, w: 4, x: 5, [y]: 6, [z]: 7]').value as any)
      .toPairs()
      .map((x) => x.value.value),
  ).toEqual(['1', '2', '3', '4', '5', '6', '7']);

  expect(
    (maraca('[[A]: 1, [A, B]: 2, [A, C]: 3, [B]: 4, [B, A]: 5]').value as any)
      .toPairs()
      .map((x) => x.value.value),
  ).toEqual(['1', '2', '3', '4', '5']);
});

test('assign shorthand', () => {
  expect(maraca('[item:=]')).toEqual({
    type: 'block',
    value: Block.fromPairs([
      {
        key: { type: 'value', value: 'item' },
        value: { type: 'value', value: 'item' },
      },
    ] as any),
  });
});
