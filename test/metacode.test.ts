import maraca from '../src/index';

test('basic', () => {
  expect(maraca('"1 + 1" $ []')).toEqual({ type: 'value', value: '2' });
  expect(maraca('"x? + 1" $ [x: 10]')).toEqual({ type: 'value', value: '11' });
  expect(maraca('"?.[a, b, c]" $ 1')).toEqual({ type: 'value', value: 'a' });
});
