import maraca from '../../src/index';
import { toPairs } from '../../src/block/set';
import { fromObj, fromPairs } from '../../src/utils/block';

test('basic', () => {
  expect(maraca('[hello, world]')).toEqual({
    type: 'block',
    value: fromObj({
      1: { type: 'value', value: 'hello' },
      2: { type: 'value', value: 'world' },
    }),
  });
  expect(maraca('[x: a, y: b]')).toEqual({
    type: 'block',
    value: fromObj({
      x: { type: 'value', value: 'a' },
      y: { type: 'value', value: 'b' },
    }),
  });
  expect(maraca('[10, key: value]')).toEqual({
    type: 'block',
    value: fromObj({
      1: { type: 'value', value: '10' },
      key: { type: 'value', value: 'value' },
    }),
  });
});

test('nils ignored', () => {
  expect(maraca("[a, , '', b]")).toEqual({
    type: 'block',
    value: fromObj({
      1: { type: 'value', value: 'a' },
      2: { type: 'value', value: 'b' },
    }),
  });
});

test('nested', () => {
  expect(maraca('[y: [a, b]]')).toEqual({
    type: 'block',
    value: fromObj({
      y: {
        type: 'block',
        value: fromObj({
          1: { type: 'value', value: 'a' },
          2: { type: 'value', value: 'b' },
        }),
      },
    }),
  });
  expect(maraca('[[a, b]: 100]')).toEqual({
    type: 'block',
    value: fromPairs(
      [
        {
          key: {
            type: 'block',
            value: fromObj({
              1: { type: 'value', value: 'a' },
              2: { type: 'value', value: 'b' },
            }),
          },
          value: { type: 'value', value: '100' },
        },
      ],
      (x) => x,
    ),
  });
});

test('sort', () => {
  expect(
    toPairs(
      maraca('[: 1, 2, 3, w: 4, x: 5, [y]: 6, [z]: 7]').value as any,
      (x) => x,
    ).map((x) => x.value.value),
  ).toEqual(['1', '2', '3', '4', '5', '6', '7']);

  expect(
    toPairs(
      maraca('[[A]: 1, [A, B]: 2, [A, C]: 3, [B]: 4, [B, A]: 5]').value as any,
      (x) => x,
    ).map((x) => x.value.value),
  ).toEqual(['1', '2', '3', '4', '5']);
});

test('set shorthand', () => {
  expect(maraca('[item:=]')).toEqual({
    type: 'block',
    value: fromObj({
      item: { type: 'value', value: 'item' },
    }),
  });
});

test('copy', () => {
  expect(maraca('[x: 10, [x:@]]')).toEqual({
    type: 'block',
    value: fromObj({
      x: { type: 'value', value: '10' },
      1: {
        type: 'block',
        value: fromObj({
          x: { type: 'value', value: '10' },
        }),
      },
    }),
  });
});
