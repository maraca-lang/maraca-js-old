import maraca from '../src/index';

test('basic', () => {
  expect(maraca({ start: 'module? + 1', module: '2' })).toEqual({
    type: 'value',
    value: '3',
  });

  expect(maraca({ start: 'a?', a: 'b?', b: '1' })).toEqual({
    type: 'value',
    value: '1',
  });
});

test('nested', () => {
  expect(
    maraca({ start: 'folder?.a', folder: { a: 'b? + 1', b: '2' } }),
  ).toEqual({
    type: 'value',
    value: '3',
  });

  expect(
    maraca({ start: 'folder?.a', b: '2', folder: { a: 'b? + 1' } }),
  ).toEqual({
    type: 'value',
    value: '3',
  });

  expect(
    maraca({
      start: 'folder?.a * b?',
      b: '5',
      folder: { a: 'b? + 1', b: '2' },
    }),
  ).toEqual({
    type: 'value',
    value: '15',
  });
});
