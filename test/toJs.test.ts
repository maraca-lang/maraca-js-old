import maraca from '../src/index';
import Block from '../src/block';
import { toJs } from '../src/data';

test('values', () => {
  expect(toJs(maraca('test'), true)).toEqual({ type: 'value', value: 'test' });

  expect(toJs(maraca(''), 'string')).toEqual(null);
  expect(toJs(maraca('test'), 'string')).toEqual('test');

  expect(toJs(maraca('test'), 'boolean')).toEqual(true);
  expect(toJs(maraca(''), 'boolean')).toEqual(null);

  expect(toJs(maraca('test'), 'number')).toEqual(null);
  expect(toJs(maraca('10.5'), 'number')).toEqual(10.5);

  expect(toJs(maraca('10.5'), 'integer')).toEqual(null);
  expect(toJs(maraca('6'), 'integer')).toEqual(6);

  expect(toJs(maraca('6'), () => 'integer')).toEqual({ value: 6 });
  expect(toJs(maraca('[x:~ 1].x'), () => 'integer')).toEqual({
    value: 1,
    push: expect.any(Function),
  });
});

test('blocks', () => {
  expect(toJs(maraca('[hello]'), true)).toEqual({
    type: 'block',
    value: Block.fromPairs([
      {
        key: { type: 'value', value: '1' },
        value: { type: 'value', value: 'hello' },
      },
    ] as any),
  });

  expect(toJs(maraca('[hello]'), ['string'])).toEqual(['hello']);
  expect(toJs(maraca('[hello, there]'), ['string'])).toEqual([
    'hello',
    'there',
  ]);
  expect(toJs(maraca('[hello, 3: there, [30]]'), ['string'])).toEqual([
    'hello',
    'there',
  ]);

  expect(toJs(maraca('[23, 45.7]'), ['number'])).toEqual([23, 45.7]);
  expect(toJs(maraca('[23, 45.7]'), ['integer'])).toEqual([23]);

  expect(toJs(maraca('[a: 1, b: 2.5]'), { a: 'string', b: 'string' })).toEqual({
    a: '1',
    b: '2.5',
  });
  expect(toJs(maraca('[a: 1, b: 2.5]'), { a: 'string', b: 'number' })).toEqual({
    a: '1',
    b: 2.5,
  });
  expect(
    toJs(maraca('[a: 1, b: 2.5]'), { a: 'integer', b: 'integer' }),
  ).toEqual({
    a: 1,
  });
  expect(toJs(maraca('[a: 1, b: 2.5]'), { '*': 'number' })).toEqual({
    a: 1,
    b: 2.5,
  });
  expect(toJs(maraca('[1, 2, a: 1, b: 2.5]'), { '*': 'number' })).toEqual({
    a: 1,
    b: 2.5,
  });
  expect(
    toJs(maraca('[a: 1, b: 2.5, c: 4]'), { a: 'string', '*': 'number' }),
  ).toEqual({
    a: '1',
    b: 2.5,
    c: 4,
  });
  expect(toJs(maraca('[hello, there]'), { 1: 'string', 2: 'string' })).toEqual({
    1: 'hello',
    2: 'there',
  });
});

test('or', () => {
  expect(toJs(maraca('test'), ['number', 'string'])).toEqual('test');
  expect(toJs(maraca('test'), ['number', 'integer'])).toEqual(null);

  expect(toJs(maraca('[1, test, 4.6]'), [['number', 'string']])).toEqual([
    1,
    'test',
    4.6,
  ]);
  expect(
    toJs(maraca('[1, test, 4.6]'), { '**': ['number', 'string'] }),
  ).toEqual({
    1: 1,
    2: 'test',
    3: 4.6,
  });
  expect(toJs(maraca('[a, b, [c, d]]'), [['string', ['string']]])).toEqual([
    'a',
    'b',
    ['c', 'd'],
  ]);
});
