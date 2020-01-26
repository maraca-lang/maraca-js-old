import maraca from '../src/index';

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

test('lists', () => {
  expect(maraca('[hello, world]')).toEqual({
    type: 'list',
    value: [
      {
        key: { type: 'value', value: '1' },
        value: { type: 'value', value: 'hello' },
      },
      {
        key: { type: 'value', value: '2' },
        value: { type: 'value', value: 'world' },
      },
    ],
  });
  expect(maraca('[x: a, y: b]')).toEqual({
    type: 'list',
    value: [
      {
        key: { type: 'value', value: 'x' },
        value: { type: 'value', value: 'a', set: expect.any(Function) },
      },
      {
        key: { type: 'value', value: 'y' },
        value: { type: 'value', value: 'b', set: expect.any(Function) },
      },
    ],
  });
  expect(maraca('[10, key: value]')).toEqual({
    type: 'list',
    value: [
      {
        key: { type: 'value', value: '1' },
        value: { type: 'value', value: '10' },
      },
      {
        key: { type: 'value', value: 'key' },
        value: { type: 'value', value: 'value', set: expect.any(Function) },
      },
    ],
  });
});

test('list nils ignored', () => {
  expect(maraca('[a, , b]')).toEqual({
    type: 'list',
    value: [
      {
        key: { type: 'value', value: '1' },
        value: { type: 'value', value: 'a' },
      },
      {
        key: { type: 'value', value: '2' },
        value: { type: 'value', value: 'b' },
      },
    ],
  });
  expect(maraca('[`comment`, 1, c: , 2]')).toEqual({
    type: 'list',
    value: [
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
        value: { type: 'value', value: '', set: expect.any(Function) },
      },
    ],
  });
});

test('nest lists', () => {
  expect(maraca('[y: [a, b]]')).toEqual({
    type: 'list',
    value: [
      {
        key: { type: 'value', value: 'y' },
        value: {
          type: 'list',
          value: [
            {
              key: { type: 'value', value: '1' },
              value: { type: 'value', value: 'a' },
            },
            {
              key: { type: 'value', value: '2' },
              value: { type: 'value', value: 'b' },
            },
          ],
        },
      },
    ],
  });
  expect(maraca('[[a, b]: 100]')).toEqual({
    type: 'list',
    value: [
      {
        key: {
          type: 'list',
          value: [
            {
              key: { type: 'value', value: '1' },
              value: { type: 'value', value: 'a' },
            },
            {
              key: { type: 'value', value: '2' },
              value: { type: 'value', value: 'b' },
            },
          ],
        },
        value: { type: 'value', value: '100', set: expect.any(Function) },
      },
    ],
  });
});

test('list sort', () => {
  expect(maraca('[z: 1, y: 2, b, a]')).toEqual({
    type: 'list',
    value: [
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
        value: { type: 'value', value: '2', set: expect.any(Function) },
      },
      {
        key: { type: 'value', value: 'z' },
        value: { type: 'value', value: '1', set: expect.any(Function) },
      },
    ],
  });
});

test('list assign shorthand', () => {
  expect(maraca('[item:=]')).toEqual({
    type: 'list',
    value: [
      {
        key: { type: 'value', value: 'item' },
        value: { type: 'value', value: 'item', set: expect.any(Function) },
      },
    ],
  });
});
