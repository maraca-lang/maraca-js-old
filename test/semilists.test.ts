import maraca from '../src/index';

test('and', () => {
  expect(maraca('(10)')).toEqual({ type: 'value', value: '10' });
  expect(maraca('(1, 2, 3)')).toEqual({ type: 'value', value: '3' });
  expect(maraca('(1, "", 3)')).toEqual({ type: 'value', value: '' });
  expect(maraca('(a, b, => c)')).toEqual({ type: 'value', value: 'b' });
  expect(maraca('(a, "", => c)')).toEqual({ type: 'value', value: 'c' });
});

test('or', () => {
  expect(maraca('{10}')).toEqual({ type: 'value', value: '10' });
  expect(maraca('{1, 2, 3}')).toEqual({ type: 'value', value: '1' });
  expect(maraca('{"", a}')).toEqual({ type: 'value', value: 'a' });
  expect(maraca('{x: 2, y: 3, x? * y?}')).toEqual({
    type: 'value',
    value: '6',
  });
  expect(maraca('{x: 1, x?}')).toEqual({
    type: 'value',
    value: '1',
    set: expect.any(Function),
  });
});
