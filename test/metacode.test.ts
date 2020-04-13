import maraca from '../src/index';

test('basic', () => {
  expect(maraca(">>'1 + 1'")).toEqual({ type: 'value', value: '2' });
  expect(maraca("[x: 10]>>'x? + 1'")).toEqual({ type: 'value', value: '11' });
  expect(maraca("1>>'?.[a, b, c]'")).toEqual({ type: 'value', value: 'a' });
});
