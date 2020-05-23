import maraca from '../../src/index';
import { fromObj } from '../../src/utils/block';

test('basic', () => {
  expect(maraca('   10 +    ')).toEqual({ type: 'value', value: '' });
  expect(maraca('[10, 10 +, 20]')).toEqual({
    type: 'block',
    value: fromObj({
      1: { type: 'value', value: '10' },
      2: { type: 'value', value: '20' },
    }),
  });
  expect(maraca("'hello [1 +]'")).toEqual({
    type: 'value',
    value: 'hello [1 +]',
  });
});
