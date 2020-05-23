import maraca from '../../src/index';
import { createBlock, fromObj } from '../../src/utils/block';

test('basic', () => {
  expect(maraca('z.[x: a, y: b, => c]')).toEqual({ type: 'value', value: 'c' });
  expect(maraca('10.[v=> @v + 5]')).toEqual({ type: 'value', value: '15' });
  expect(maraca('[1, 2].[[x, y]=> @x + @y]')).toEqual({
    type: 'value',
    value: '3',
  });
  expect(maraca('[1, 2, 3].[[x, => y]=> @x + @y.2]')).toEqual({
    type: 'value',
    value: '4',
  });
});

test('maps', () => {
  expect(maraca('[a, b, c].[=>> ]')).toEqual({
    type: 'block',
    value: createBlock(),
  });
  expect(maraca('[5, 10].[v=> k=> [@v, @k]]')).toEqual({
    type: 'block',
    value: fromObj({
      1: {
        type: 'block',
        value: fromObj({
          1: { type: 'value', value: '5' },
          2: { type: 'value', value: '1' },
        }),
      },
      2: {
        type: 'block',
        value: fromObj({
          1: { type: 'value', value: '10' },
          2: { type: 'value', value: '2' },
        }),
      },
    }),
  });
  expect(maraca('[5, 10].[v=>> @v + 5]')).toEqual({
    type: 'block',
    value: fromObj({
      1: { type: 'value', value: '10' },
      2: { type: 'value', value: '15' },
    }),
  });
  expect(maraca('[a, b].[v=>> Item (@v): @v]')).toEqual({
    type: 'block',
    value: fromObj({
      'Item a': { type: 'value', value: 'a' },
      'Item b': { type: 'value', value: 'b' },
    }),
  });
  // expect(maraca('[1, 2, 3].[sum: 0, v=>> sum: @sum + @v]')).toEqual({
  //   type: 'block',
  //   value: fromObj({
  //     sum: { type: 'value', value: '6' },
  //   }),
  // });
  expect(maraca('1.[=>> ]')).toEqual({ type: 'value', value: '' });
  expect(maraca('1.[v=>> @v + 1]')).toEqual({ type: 'value', value: '' });
  expect(maraca('[a: 1, b: 2, c: 3].[v=>> : [@v]]')).toEqual({
    type: 'block',
    value: fromObj({
      1: { type: 'value', value: '1' },
      2: { type: 'value', value: '2' },
      3: { type: 'value', value: '3' },
    }),
  });
});

test('eval', () => {
  expect(maraca(">>'1 + 1'")).toEqual({ type: 'value', value: '2' });
  expect(maraca("[x: 10]>>'@x + 1'")).toEqual({ type: 'value', value: '11' });
  expect(maraca("1>>'@x + 1'")).toEqual({ type: 'value', value: '' });
});
