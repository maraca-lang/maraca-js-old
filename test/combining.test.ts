import maraca from '../src/index';

test('values', () => {
  expect(maraca('Hello world')).toEqual({
    type: 'value',
    value: 'Hello world',
  });
  expect(maraca('\\£30')).toEqual({
    type: 'value',
    value: '£30',
  });
  expect(maraca('"" WX YZ')).toEqual({
    type: 'value',
    value: 'WX YZ',
  });
  expect(maraca('A \\\nB')).toEqual({
    type: 'value',
    value: 'A\nB',
  });
});

test('list lookup', () => {
  expect(maraca('y [x: a, y: b]')).toEqual({
    type: 'value',
    value: 'b',
    set: expect.any(Function),
  });
  expect(maraca('[x: a, y: b]x')).toEqual({
    type: 'value',
    value: 'a',
    set: expect.any(Function),
  });
  expect(maraca('2 [a, b, c]')).toEqual({
    type: 'value',
    value: 'b',
  });
  expect(maraca('[a, b, c]1')).toEqual({
    type: 'value',
    value: 'a',
  });
  expect(maraca('[x: a, y: b] z')).toEqual({
    type: 'value',
    value: '',
  });
});

test('dot', () => {
  expect(maraca('hello.world')).toEqual({
    type: 'value',
    value: 'helloworld',
  });
  expect(maraca('[a b: c].a b')).toEqual({
    type: 'value',
    value: 'c',
    set: expect.any(Function),
  });
  expect(maraca('"".z')).toEqual({
    type: 'value',
    value: '',
  });
});
