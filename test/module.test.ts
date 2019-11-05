import maraca from '../src/index';

test('basic', () => {
  expect(maraca(['module? + 1', { module: '2' }])).toEqual({
    type: 'value',
    value: '3',
  });
});
