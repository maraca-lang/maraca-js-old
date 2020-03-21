import maraca from '../src/index';
import Box from '../src/box';

test('arithmetic', () => {
  expect(maraca('1 + 2')).toEqual({
    type: 'value',
    value: '3',
  });
  expect(maraca('5 - 1')).toEqual({
    type: 'value',
    value: '4',
  });
  expect(maraca('3 * 4')).toEqual({
    type: 'value',
    value: '12',
  });
  expect(maraca('5 / 2')).toEqual({
    type: 'value',
    value: '2.5',
  });
  expect(maraca('8 % 3')).toEqual({
    type: 'value',
    value: '2',
  });
  expect(maraca('5 % 5')).toEqual({
    type: 'value',
    value: '5',
  });
  expect(maraca('1 + hi')).toEqual({
    type: 'value',
    value: '',
  });
});

test('negative', () => {
  expect(maraca('-20')).toEqual({
    type: 'value',
    value: '-20',
  });
  expect(maraca('-hello')).toEqual({
    type: 'value',
    value: '-hello',
  });
});

test('comparison', () => {
  expect(maraca('John ~ James')).toEqual({
    type: 'value',
    value: '1.6987999999999999',
  });
  expect(maraca('John ~ Jon')).toEqual({
    type: 'value',
    value: '1.1893333333333334',
  });
  expect(maraca('2 = 6')).toEqual({
    type: 'value',
    value: '',
  });
  expect(maraca('3 = 3')).toEqual({
    type: 'value',
    value: 'true',
  });
  expect(maraca('5 < 3')).toEqual({
    type: 'value',
    value: '',
  });
  expect(maraca('5 <= 5')).toEqual({
    type: 'value',
    value: 'true',
  });
  expect(maraca('8 > 2')).toEqual({
    type: 'value',
    value: 'true',
  });
  expect(maraca('1 >= 3')).toEqual({
    type: 'value',
    value: '',
  });
});

test('not', () => {
  expect(maraca('8 ! 2')).toEqual({
    type: 'value',
    value: 'true',
  });
  expect(maraca('!3 < 5')).toEqual({
    type: 'value',
    value: '',
  });
});

test('size', () => {
  expect(maraca('#[a, b, c]')).toEqual({
    type: 'value',
    value: '3',
  });
  expect(maraca('#3')).toEqual({
    type: 'box',
    value: Box.fromPairs([
      {
        key: { type: 'value', value: '1' },
        value: { type: 'value', value: '1' },
      },
      {
        key: { type: 'value', value: '2' },
        value: { type: 'value', value: '2' },
      },
      {
        key: { type: 'value', value: '3' },
        value: { type: 'value', value: '3' },
      },
    ] as any),
  });
});
