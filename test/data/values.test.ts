import maraca from '../../src/index';

test('basic', () => {
  expect(maraca('1')).toEqual({ type: 'value', value: '1' });
  expect(maraca('abc')).toEqual({ type: 'value', value: 'abc' });
});

test('nil', () => {
  expect(maraca('')).toEqual({ type: 'value', value: '' });
  expect(maraca("''")).toEqual({ type: 'value', value: '' });
});

test('special chars', () => {
  expect(maraca('\\@')).toEqual({ type: 'value', value: '@' });
  expect(maraca('_')).toEqual({ type: 'value', value: ' ' });
});

test('quotes', () => {
  expect(maraca("'Hello \\'world\\'!'")).toEqual({
    type: 'value',
    value: "Hello 'world'!",
  });
  expect(maraca("'A\nB\nC'")).toEqual({
    type: 'value',
    value: 'A\nB\nC',
  });
});

test('join', () => {
  expect(maraca('Hello world')).toEqual({
    type: 'value',
    value: 'Hello world',
  });
  expect(maraca('\\£30')).toEqual({
    type: 'value',
    value: '£30',
  });
  expect(maraca("'' WX YZ")).toEqual({
    type: 'value',
    value: 'WX YZ',
  });
  expect(maraca('A \\\nB')).toEqual({
    type: 'value',
    value: 'A\nB',
  });
});
