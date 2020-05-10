import maraca from '../src/index';
import { createBlock, fromPairs } from '../src/block/util';

test('basic', () => {
  expect(maraca('[x: a, y: @x]')).toEqual({
    type: 'block',
    value: fromPairs([
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
  expect(maraca('[x: a, y: @z, z: b]')).toEqual({
    type: 'block',
    value: fromPairs([
      {
        key: { type: 'value', value: 'x' },
        value: { type: 'value', value: 'a' },
      },
      {
        key: { type: 'value', value: 'y' },
        value: { type: 'value', value: 'b' },
      },
      {
        key: { type: 'value', value: 'z' },
        value: { type: 'value', value: 'b' },
      },
    ] as any),
  });
});

test('nested', () => {
  expect(maraca('[x: a, y: [@x]]')).toEqual({
    type: 'block',
    value: fromPairs([
      {
        key: { type: 'value', value: 'x' },
        value: { type: 'value', value: 'a' },
      },
      {
        key: { type: 'value', value: 'y' },
        value: {
          type: 'block',
          value: fromPairs([
            {
              key: { type: 'value', value: '1' },
              value: { type: 'value', value: 'a' },
            },
          ] as any),
        },
      },
    ] as any),
  });
  expect(maraca('[a, [@1]]')).toEqual({
    type: 'block',
    value: fromPairs([
      {
        key: { type: 'value', value: '1' },
        value: { type: 'value', value: 'a' },
      },
      {
        key: { type: 'value', value: '2' },
        value: { type: 'block', value: createBlock() },
      },
    ] as any),
  });
  expect(maraca('[[x: a], @x]')).toEqual({
    type: 'block',
    value: fromPairs([
      {
        key: { type: 'value', value: '1' },
        value: {
          type: 'block',
          value: fromPairs([
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

test('destructure', () => {
  expect(maraca('[[x]: [10], @x]')).toEqual({
    type: 'block',
    value: fromPairs([
      {
        key: { type: 'value', value: '1' },
        value: { type: 'value', value: '10' },
      },
      {
        key: { type: 'value', value: 'x' },
        value: { type: 'value', value: '10' },
      },
    ] as any),
  });
});
