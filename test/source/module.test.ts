import maraca from '../../src/index';
import Block from '../../src/block';

test('basic', () => {
  expect(maraca({ '': '@module + 1', module: '2' })).toEqual({
    type: 'value',
    value: '3',
  });

  expect(maraca({ '': '@a', a: '@b', b: '1' })).toEqual({
    type: 'value',
    value: '1',
  });

  expect(maraca({ a: '1', b: '2' })).toEqual({
    type: 'block',
    value: Block.fromPairs([
      {
        key: { type: 'value', value: 'a' },
        value: { type: 'value', value: '1' },
      },
      {
        key: { type: 'value', value: 'b' },
        value: { type: 'value', value: '2' },
      },
    ] as any),
  });
});

test('nested', () => {
  expect(maraca({ '': '@folder.a', folder: { a: '@b + 1', b: '2' } })).toEqual({
    type: 'value',
    value: '3',
  });

  expect(maraca({ '': '@folder.a', b: '2', folder: { a: '@b + 1' } })).toEqual({
    type: 'value',
    value: '3',
  });

  expect(
    maraca({
      '': '@folder.a * @b',
      b: '5',
      folder: { a: '@b + 1', b: '2' },
    }),
  ).toEqual({
    type: 'value',
    value: '15',
  });

  expect(maraca({ '': '@folder', folder: { '': '@a', a: '1' } })).toEqual({
    type: 'value',
    value: '1',
  });
});
