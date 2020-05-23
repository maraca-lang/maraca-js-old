import maraca from '../../src/index';
import { fromObj } from '../../src/utils/block';

test('basic', () => {
  expect(maraca('["     "]')).toEqual({
    type: 'block',
    value: fromObj({
      1: { type: 'value', value: ' ' },
    }),
  });

  expect(maraca(`["hello    there"]`)).toEqual({
    type: 'block',
    value: fromObj({
      1: { type: 'value', value: 'hello there' },
    }),
  });

  expect(maraca(`["    hello    there     "]`)).toEqual({
    type: 'block',
    value: fromObj({
      1: { type: 'value', value: ' hello there ' },
    }),
  });
});

test('lines', () => {
  expect(
    maraca(`["hello    
    there"]`),
  ).toEqual({
    type: 'block',
    value: fromObj({
      1: { type: 'value', value: 'hello there' },
    }),
  });

  expect(
    maraca(`["hello    

    there"]`),
  ).toEqual({
    type: 'block',
    value: fromObj({
      1: { type: 'value', value: 'hello\n\nthere' },
    }),
  });

  expect(
    maraca(`["   hello    

      there    "]`),
  ).toEqual({
    type: 'block',
    value: fromObj({
      1: { type: 'value', value: ' hello\n\nthere ' },
    }),
  });
});

test('nest', () => {
  expect(maraca(`["hello <there/>"]`)).toEqual({
    type: 'block',
    value: fromObj({
      1: { type: 'value', value: 'hello ' },
      2: {
        type: 'block',
        value: fromObj({
          1: { type: 'value', value: 'there' },
        }),
      },
    }),
  });

  expect(
    maraca(`["  hello   
  <there/>    
  
  there   "]`),
  ).toEqual({
    type: 'block',
    value: fromObj({
      1: { type: 'value', value: ' hello ' },
      2: {
        type: 'block',
        value: fromObj({
          1: { type: 'value', value: 'there' },
        }),
      },
      3: { type: 'value', value: '\n\nthere ' },
    }),
  });
});
