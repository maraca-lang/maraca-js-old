import {
  sortStrings,
  stringToValue,
  table,
  toData,
  toDateData,
  toNumber,
  toString,
} from './data';
import stream from './stream';

const unary = func => a$ => stream.map(a$, func);

const binary = func => a$ =>
  stream.map(a$, a => ({
    type: 'function',
    value: b$ => stream.map(b$, b => func(a, b)),
  }));

const typeFunc = (toType, func) =>
  binary((a, b) => {
    const v1 = toType(a);
    const v2 = toType(b);
    if (v1 === null || v2 === null) return { type: 'nil' };
    return toData(func(v1, v2));
  });

export const asFunction = func => {
  if (func.type === 'function') return func.value;
  return value$ =>
    stream.map(value$, value => {
      if (func.type === 'nil' || func.type === 'string') {
        if (value.type === 'table') {
          return table.get(value.value, func);
        }
        if (func.type === 'nil' || value.type === 'nil') {
          return { type: 'nil' };
        }
        if (func.type === 'string' && value.type === 'string') {
          if (func.value === '-') {
            const v = stringToValue(value.value);
            if (typeof v === 'string') return { type: 'nil' };
            return { type: 'string', value: `${-v}` };
          }
          return { type: 'string', value: `${func.value} ${value.value}` };
        }
        return { type: 'nil' };
      }
      if (func.type === 'table') {
        if (value.type !== 'table') return { type: 'nil' };
        // TODO
      }
      return { type: 'nil' };
    });
};

export default {
  '[*': (a$, scope$) =>
    stream.group([a$, scope$], ([a, scope]) => ({
      type: 'table',
      value: table.fill(scope.value, a),
    })),
  '*]': (a$, scope$) =>
    stream.group([a$, scope$], ([a, scope]) => ({
      type: 'table',
      value: table.fillGroup(scope.value, a),
    })),
  '>>': a$ => {
    const emitter = stream.emitter({ type: 'string', value: 'test' });
    return stream.map(a$, a => ({
      type: 'function',
      value: (b$, scope$) => {
        return stream.group([emitter.stream, b$, scope$], ([x, b, scope]) => {
          return {
            type: 'table',
            value: table.set(
              table.set(scope.value, a, {
                type: 'source',
                value: y => emitter.emit(toData(y)),
              }),
              b,
              x,
            ),
          };
        });
      },
    }));
  },
  ':=': a$ =>
    stream.map(a$, a => ({
      type: 'function',
      value: (b$, scope$) =>
        stream.group([b$, scope$], ([b, scope]) => ({
          type: 'table',
          value: table.set(scope.value, a, b),
        })),
    })),
  '::': (a$, scope$) =>
    stream.group([a$, scope$], ([a, scope]) => ({
      type: 'table',
      value: table.append(scope.value, a),
    })),
  '~': binary((id, value) => ({ ...value, id })),
  or: binary((a, b) => (a.type === 'nil' ? b : a)),
  and: binary((a, b) => (a.type === 'nil' ? a : b)),
  '=': binary((a, b) => a.type === b.type && a.value === b.value),
  '!=': binary((a, b) => a.type !== b.type || a.value !== b.value),
  '<': typeFunc(toString, (a, b) => sortStrings(a, b) === 1),
  '>': typeFunc(toString, (a, b) => sortStrings(a, b) === -1),
  '<=': typeFunc(toString, (a, b) => sortStrings(a, b) !== 1),
  '>=': typeFunc(toString, (a, b) => sortStrings(a, b) !== -1),
  '..': typeFunc(toString, (a, b) => a + b),
  '+': typeFunc(toNumber, (a, b) => a + b),
  '-': typeFunc(toNumber, (a, b) => a - b),
  '*': typeFunc(toNumber, (a, b) => a * b),
  '/': typeFunc(toNumber, (a, b) => a / b),
  '%': typeFunc(toNumber, (a, b) => ((a % b) + b) % b),
  '^': typeFunc(toNumber, (a, b) => a ** b),
  '&': a$ => ({ type: 'function', value: b$ => stream.merge([a$, b$]) }),
  not: unary(
    a => (a.type === 'nil' ? { type: 'string', value: '1' } : { type: 'nil' }),
  ),
  '@': a$ =>
    stream.flatMap(a$, a =>
      stream.create(
        () => toDateData(a),
        emit => {
          const interval = setInterval(() => {
            emit(toDateData(a));
          }, 1 * 1000);
          return () => clearInterval(interval);
        },
      ),
    ),
  unpack: (a$, scope$) =>
    stream.group([a$, scope$], ([a, scope]) => ({
      type: 'table',
      value: table.merge(scope.value, a),
    })),
};
