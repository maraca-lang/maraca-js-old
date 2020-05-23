import maraca from '../src/index';
import { createBlock, fromObj } from '../src/utils/block';

test('basic', () => {
  expect(maraca('[x: a, y: @x]')).toEqual({
    type: 'block',
    value: fromObj({
      x: { type: 'value', value: 'a' },
      y: { type: 'value', value: 'a' },
    }),
  });
});

test('order', () => {
  expect(maraca('[x: a, y: @z, z: b]')).toEqual({
    type: 'block',
    value: fromObj({
      x: { type: 'value', value: 'a' },
      y: { type: 'value', value: 'b' },
      z: { type: 'value', value: 'b' },
    }),
  });
});

test('nested', () => {
  expect(maraca('[x: a, y: [@x]]')).toEqual({
    type: 'block',
    value: fromObj({
      x: { type: 'value', value: 'a' },
      y: {
        type: 'block',
        value: fromObj({
          1: { type: 'value', value: 'a' },
        }),
      },
    }),
  });
  expect(maraca('[a, [@1]]')).toEqual({
    type: 'block',
    value: fromObj({
      1: { type: 'value', value: 'a' },
      2: { type: 'block', value: createBlock() },
    }),
  });
  expect(maraca('[[x: a], @x]')).toEqual({
    type: 'block',
    value: fromObj({
      1: {
        type: 'block',
        value: fromObj({
          x: { type: 'value', value: 'a' },
        }),
      },
    }),
  });
});

test('destructure', () => {
  expect(maraca('[[x]: [10], @x]')).toEqual({
    type: 'block',
    value: fromObj({
      1: { type: 'value', value: '10' },
      x: { type: 'value', value: '10' },
    }),
  });
});
