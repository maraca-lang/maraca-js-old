import maraca from '../../src/index';
import { fromObj } from '../../src/utils/block';

test('basic', () => {
  expect(maraca('[[a, b, x: c]: [1, 2, x: 3]]')).toEqual({
    type: 'block',
    value: fromObj({
      a: { type: 'value', value: '1' },
      b: { type: 'value', value: '2' },
      c: { type: 'value', value: '3' },
    }),
  });
  expect(maraca('[[_, _, a]: [1, 2, 3]]')).toEqual({
    type: 'block',
    value: fromObj({
      ' ': { type: 'value', value: '2' },
      a: { type: 'value', value: '3' },
    }),
  });
});

test('partial', () => {
  expect(maraca('[[x, y]: [1, 2, 3]]')).toEqual({
    type: 'block',
    value: fromObj({
      x: { type: 'value', value: '1' },
      y: { type: 'value', value: '2' },
    }),
  });
  expect(maraca('[[a, => b]: [1, 2, 3]]')).toEqual({
    type: 'block',
    value: fromObj({
      a: { type: 'value', value: '1' },
      b: {
        type: 'block',
        value: fromObj({
          1: { type: 'value', value: '2' },
          2: { type: 'value', value: '3' },
        }),
      },
    }),
  });
  expect(maraca('[[a:=, b:=]: [a: 1, b: 2, c: 3, d: 4]]')).toEqual({
    type: 'block',
    value: fromObj({
      a: { type: 'value', value: '1' },
      b: { type: 'value', value: '2' },
    }),
  });
});

test('unpack', () => {
  expect(maraca('[:[a], a]')).toEqual({
    type: 'block',
    value: fromObj({
      1: { type: 'value', value: 'a' },
      2: { type: 'value', value: 'a' },
    }),
  });
  expect(maraca('[x: 1, : [y: 2, z: 3]]')).toEqual({
    type: 'block',
    value: fromObj({
      x: { type: 'value', value: '1' },
      y: { type: 'value', value: '2' },
      z: { type: 'value', value: '3' },
    }),
  });
  expect(maraca('[1, 2, : [3, 4]]')).toEqual({
    type: 'block',
    value: fromObj({
      1: { type: 'value', value: '1' },
      2: { type: 'value', value: '2' },
      3: { type: 'value', value: '3' },
      4: { type: 'value', value: '4' },
    }),
  });
});
