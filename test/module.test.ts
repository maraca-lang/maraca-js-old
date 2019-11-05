import maraca from '../src/index';

test('basic', () => {
  expect(maraca(['module? + 1', { module: '2' }])).toEqual({
    type: 'value',
    value: '3',
  });

  expect(maraca(['a?', { a: 'b?', b: '1' }])).toEqual({
    type: 'value',
    value: '1',
  });
});
