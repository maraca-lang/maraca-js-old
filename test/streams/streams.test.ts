import maraca, { resolve } from '../../src/index';
import { toPairs } from '../../src/block/set';
import { fromJs, fromObj, streamMap } from '../../src/utils';

const library = {
  size: (set) =>
    set(
      fromJs((arg) =>
        streamMap((get) => {
          const v = resolve(arg, get);
          return fromJs(
            v.type === 'block' &&
              toPairs(v.value, (x) => x).filter((x) => x.value.value).length,
          );
        }),
      ),
    ),
  tick: (set) => {
    let count = 1;
    set(fromJs(count++));
    const interval = setInterval(() => set(fromJs(count++)), 1000);
    return (dispose) => dispose && clearInterval(interval);
  },
};

const testStream = (code, values, done) => {
  let c = 0;
  const stop = maraca({ '': code, ...library }, (data) => {
    expect(data).toEqual(values[c]);
    if (!values[++c]) {
      stop();
      done();
    }
  });
};

test('lib', (done) => {
  expect(maraca({ '': '@size.[1, 2, 3]', ...library })).toEqual({
    type: 'value',
    value: '3',
  });
  testStream(
    '@tick',
    [
      { type: 'value', value: '1' },
      { type: 'value', value: '2' },
    ],
    done,
  );
});

test('trigger', (done) => {
  testStream(
    '@tick | 10',
    [
      { type: 'value', value: '10' },
      { type: 'value', value: '10' },
    ],
    done,
  );
});

test('push', (done) => {
  testStream(
    '[x:~ 10, @tick | @x + 10 -> @x]',
    [
      {
        type: 'block',
        value: fromObj({
          x: { type: 'value', value: '10', push: expect.any(Function) },
        }),
      },
      {
        type: 'block',
        value: fromObj({
          x: { type: 'value', value: '20', push: expect.any(Function) },
        }),
      },
    ],
    done,
  );
});

test.skip('push block', (done) => {
  testStream(
    '[x:~ [a], @tick | [: @x, a] -> @x]',
    [
      {
        type: 'block',
        value: fromObj({
          x: {
            type: 'block',
            value: fromObj({
              1: { type: 'value', value: 'a' },
            }),
            push: expect.any(Function),
          },
        }),
      },
      {
        type: 'block',
        value: fromObj({
          x: {
            type: 'block',
            value: fromObj({
              1: { type: 'value', value: 'a' },
              2: { type: 'value', value: 'a' },
            }),
            push: expect.any(Function),
          },
        }),
      },
    ],
    done,
  );
});
