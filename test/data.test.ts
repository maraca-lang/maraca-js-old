import maraca from '../src/index';
import Block from '../src/block';

test('nil', () => {
  expect(maraca('')).toEqual({ type: 'value', value: '' });
  expect(maraca('""')).toEqual({ type: 'value', value: '' });
});

test('values', () => {
  expect(maraca('1')).toEqual({ type: 'value', value: '1' });
  expect(maraca('abc')).toEqual({ type: 'value', value: 'abc' });
  expect(maraca('5.8')).toEqual({ type: 'value', value: '5.8' });
});

test('special chars', () => {
  expect(maraca('\\@')).toEqual({ type: 'value', value: '@' });
  expect(maraca('_')).toEqual({ type: 'value', value: ' ' });
});

test('double quotes', () => {
  expect(maraca('"Hello \\"world\\"!"')).toEqual({
    type: 'value',
    value: 'Hello "world"!',
  });
  expect(maraca('"A\nB\nC"')).toEqual({
    type: 'value',
    value: 'A\nB\nC',
  });
});

test('comments', () => {
  expect(maraca('`This is a comment`')).toEqual({ type: 'value', value: '' });
});

test('blocks', () => {
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
        value: { type: 'value', value: 'a', push: expect.any(Function) },
      },
      {
        key: { type: 'value', value: 'y' },
        value: { type: 'value', value: 'b', push: expect.any(Function) },
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
        value: { type: 'value', value: 'value', push: expect.any(Function) },
      },
    ] as any),
  });
});

test('block nils ignored', () => {
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
  expect(maraca('[`comment`, 1, c: , 2]')).toEqual({
    type: 'block',
    value: Block.fromPairs([
      {
        key: { type: 'value', value: '1' },
        value: { type: 'value', value: '1' },
      },
      {
        key: { type: 'value', value: '2' },
        value: { type: 'value', value: '2' },
      },
      {
        key: { type: 'value', value: 'c' },
        value: { type: 'value', value: '', push: expect.any(Function) },
      },
    ] as any),
  });
});

test('nest blocks', () => {
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
          push: expect.any(Function),
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
        value: { type: 'value', value: '100', push: expect.any(Function) },
      },
    ] as any),
  });
});

test('block sort', () => {
  expect(maraca('[z: 1, y: 2, b, a]')).toEqual({
    type: 'block',
    value: Block.fromPairs([
      {
        key: { type: 'value', value: '1' },
        value: { type: 'value', value: 'b' },
      },
      {
        key: { type: 'value', value: '2' },
        value: { type: 'value', value: 'a' },
      },
      {
        key: { type: 'value', value: 'y' },
        value: { type: 'value', value: '2', push: expect.any(Function) },
      },
      {
        key: { type: 'value', value: 'z' },
        value: { type: 'value', value: '1', push: expect.any(Function) },
      },
    ] as any),
  });
});

test('block assign shorthand', () => {
  expect(maraca('[item:=]')).toEqual({
    type: 'block',
    value: Block.fromPairs([
      {
        key: { type: 'value', value: 'item' },
        value: { type: 'value', value: 'item', push: expect.any(Function) },
      },
    ] as any),
  });
});
