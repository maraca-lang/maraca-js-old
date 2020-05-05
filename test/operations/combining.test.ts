import maraca from '../../src/index';

test('dot', () => {
  expect(maraca('y.[x: a, y: b]')).toEqual({
    type: 'value',
    value: 'b',
  });
  expect(maraca('[x: a, y: b].x')).toEqual({
    type: 'value',
    value: 'a',
  });
  expect(maraca('2.[a, b, c]')).toEqual({
    type: 'value',
    value: 'b',
  });
  expect(maraca('[a, b, c].1')).toEqual({
    type: 'value',
    value: 'a',
  });
  expect(maraca('[x: a, y: b].z')).toEqual({
    type: 'value',
    value: '',
  });
  expect(maraca('[[a, b]: 1].[a, b]')).toEqual({
    type: 'value',
    value: '',
  });
  expect(maraca('[a, b].[[a, b]: 1] ')).toEqual({
    type: 'value',
    value: '',
  });
  expect(maraca('[a b: c].a b')).toEqual({
    type: 'value',
    value: 'c',
  });
  expect(maraca("''.z")).toEqual({
    type: 'value',
    value: '',
  });
});
