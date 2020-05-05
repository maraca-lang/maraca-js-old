import maraca from '../../src/index';
import Block from '../../src/block';
import { fromJs } from '../../src/data';
import { streamMap } from '../../src/util';

const library = {
  size: (set) =>
    set(
      fromJs((arg) =>
        streamMap((get) => {
          const v = get(arg, true);
          return fromJs(
            v.type === 'block' &&
              v.value.toPairs().filter((x) => x.value.value).length,
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
    '[x:~ 10, @tick | @x + 10 -> @x].x',
    [
      { type: 'value', value: '10', push: expect.any(Function) },
      { type: 'value', value: '20', push: expect.any(Function) },
    ],
    done,
  );
});

test('push block', (done) => {
  testStream(
    '[x:~ [a], @tick | [: @x, a] -> @x].x',
    [
      {
        type: 'block',
        value: Block.fromPairs([
          {
            key: { type: 'value', value: '1' },
            value: { type: 'value', value: 'a' },
          },
        ] as any),
        push: expect.any(Function),
      },
      {
        type: 'block',
        value: Block.fromPairs([
          {
            key: { type: 'value', value: '1' },
            value: { type: 'value', value: 'a' },
          },
          {
            key: { type: 'value', value: '2' },
            value: { type: 'value', value: 'a' },
          },
        ] as any),
        push: expect.any(Function),
      },
    ],
    done,
  );
});