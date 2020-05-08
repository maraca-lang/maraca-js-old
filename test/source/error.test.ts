import maraca from '../../src/index';
import Block from '../../src/block/block';

test('basic', () => {
  expect(maraca('   10 +    ')).toEqual({ type: 'value', value: '' });
  expect(maraca('[10, 10 +, 20]')).toEqual({
    type: 'block',
    value: Block.fromPairs([
      {
        key: { type: 'value', value: '1' },
        value: { type: 'value', value: '10' },
      },
      {
        key: { type: 'value', value: '2' },
        value: { type: 'value', value: '20' },
      },
    ] as any),
  });
  expect(maraca("'hello [1 +]'")).toEqual({
    type: 'value',
    value: 'hello [1 +]',
  });
});
