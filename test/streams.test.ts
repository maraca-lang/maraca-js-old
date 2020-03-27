import maraca from '../src/index';
import Block from '../src/block';
import { fromJs } from '../src/data';

const library = {
  size: fromJs((emit) => (x) =>
    x &&
    emit(
      fromJs(
        x.type === 'block'
          ? x.value.toPairs().filter((v) => v.value.value).length
          : '0',
      ),
    ),
  ),
  tick: (emit) => {
    let count = 1;
    emit(fromJs(count++));
    const interval = setInterval(() => emit(fromJs(count++)), 1000);
    return () => clearInterval(interval);
  },
};

const testStream = (code, values, done) => {
  let c = 0;
  const stop = maraca(code, library, (data) => {
    expect(data).toEqual(values[c]);
    if (!values[++c]) {
      stop();
      done();
    }
  });
};

test('lib', (done) => {
  expect(maraca('size?.[1, 2, 3]', library)).toEqual({
    type: 'value',
    value: '3',
  });
  testStream(
    'tick?',
    [
      { type: 'value', value: '1' },
      { type: 'value', value: '2' },
    ],
    done,
  );
});

test('trigger', (done) => {
  testStream(
    'tick? | 10',
    [
      { type: 'value', value: '10' },
      { type: 'value', value: '10' },
    ],
    done,
  );
});

test('push', (done) => {
  testStream(
    '[x: 10, tick? | x? + 10 -> x?].x',
    [
      { type: 'value', value: '10', push: expect.any(Function) },
      { type: 'value', value: '20', push: expect.any(Function) },
    ],
    done,
  );
});

test('push block', (done) => {
  testStream(
    '[x: [a], tick? | [: x?, a] -> x?].x',
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
