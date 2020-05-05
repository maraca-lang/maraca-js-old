import maraca from '../../src/index';
import Block from '../../src/block';

test('basic', () => {
  expect(maraca('["     "]')).toEqual({
    type: 'block',
    value: Block.fromPairs([
      {
        key: { type: 'value', value: '1' },
        value: { type: 'value', value: ' ' },
      },
    ] as any),
  });

  expect(maraca(`["hello    there"]`)).toEqual({
    type: 'block',
    value: Block.fromPairs([
      {
        key: { type: 'value', value: '1' },
        value: { type: 'value', value: 'hello there' },
      },
    ] as any),
  });

  expect(maraca(`["    hello    there     "]`)).toEqual({
    type: 'block',
    value: Block.fromPairs([
      {
        key: { type: 'value', value: '1' },
        value: { type: 'value', value: ' hello there ' },
      },
    ] as any),
  });
});

test('lines', () => {
  expect(
    maraca(`["hello    
    there"]`),
  ).toEqual({
    type: 'block',
    value: Block.fromPairs([
      {
        key: { type: 'value', value: '1' },
        value: { type: 'value', value: 'hello there' },
      },
    ] as any),
  });

  expect(
    maraca(`["hello    

    there"]`),
  ).toEqual({
    type: 'block',
    value: Block.fromPairs([
      {
        key: { type: 'value', value: '1' },
        value: { type: 'value', value: 'hello\n\nthere' },
      },
    ] as any),
  });

  expect(
    maraca(`["   hello    

      there    "]`),
  ).toEqual({
    type: 'block',
    value: Block.fromPairs([
      {
        key: { type: 'value', value: '1' },
        value: { type: 'value', value: ' hello\n\nthere ' },
      },
    ] as any),
  });
});

test('nest', () => {
  expect(maraca(`["hello <there/>"]`)).toEqual({
    type: 'block',
    value: Block.fromPairs([
      {
        key: { type: 'value', value: '1' },
        value: { type: 'value', value: 'hello ' },
      },
      {
        key: { type: 'value', value: '2' },
        value: {
          type: 'block',
          value: Block.fromPairs([
            {
              key: { type: 'value', value: '1' },
              value: { type: 'value', value: 'there' },
            },
          ] as any),
        },
      },
    ] as any),
  });

  expect(
    maraca(`["  hello   
  <there/>    
  
  there   "]`),
  ).toEqual({
    type: 'block',
    value: Block.fromPairs([
      {
        key: { type: 'value', value: '1' },
        value: { type: 'value', value: ' hello ' },
      },
      {
        key: { type: 'value', value: '2' },
        value: {
          type: 'block',
          value: Block.fromPairs([
            {
              key: { type: 'value', value: '1' },
              value: { type: 'value', value: 'there' },
            },
          ] as any),
        },
      },
      {
        key: { type: 'value', value: '3' },
        value: { type: 'value', value: '\n\nthere ' },
      },
    ] as any),
  });
});
