import build from '../build';
import { fromJs, fromPairs, isResolved } from '../utils';

import { staticSet } from './set';

const getStatic = (keys, arg) =>
  keys
    .map((key, i) => {
      if (!key || key.type !== 'value') return null;
      return { key, value: { type: 'map', arg, map: (x) => x[i] } };
    })
    .filter((x) => x);

const getCompiled = (create, keys, map, bodyKey, bodyValue) => {
  const trace = {};
  if (keys.filter((a) => a).every((a) => a.type === 'value')) {
    const scope = {
      type: 'block',
      value: fromPairs(getStatic(keys, trace)),
    };
    const compileBody = (body) => {
      const result = build(create, () => scope, body);
      if (isResolved(result)) return () => result;
      if (result.type === 'map' && result.arg === trace) return result.map;
    };
    if (
      map &&
      !bodyKey &&
      bodyValue.type === 'block' &&
      bodyValue.info.bracket === '[' &&
      bodyValue.nodes.length === 1
    ) {
      return { key: true, value: compileBody(bodyValue.nodes[0]) };
    }
    return {
      key: bodyKey === true ? (x) => x[0] : bodyKey && compileBody(bodyKey),
      value: compileBody(bodyValue),
    };
  }
};

const createFunc = (create, getScope, info, args) => {
  const compiled = getCompiled(create, args, info.map, info.key, info.value);
  if (compiled) {
    if (info.map) {
      if (compiled.key && compiled.value) {
        return [
          (pairs) =>
            pairs.map(({ key, value }, i) => ({
              key:
                compiled.key === true
                  ? fromJs(i + 1)
                  : compiled.key([key, value], (x) => x),
              value: compiled.value([key, value], (x) => x),
            })),
          true,
          true,
        ];
      }
    } else {
      if (compiled.value) {
        return [
          (_, value) => [compiled.value([null, value], (x) => x)],
          false,
          true,
        ];
      }
    }
  }

  const funcMap = (key = null) => (create, value) => {
    const argValues = [key, value];
    const newGetScope = () => {
      let newScope = getScope();
      args.forEach((k, i) => {
        if (k) newScope.value = staticSet(newScope.value, argValues[i], k);
      });
      return newScope;
    };
    return [
      build(create, newGetScope, info.value),
      info.key === true
        ? key
        : info.key && build(create, newGetScope, info.key),
    ];
  };
  return [info.map ? funcMap : funcMap(), info.map];
};

export default (create, getScope, info, args) => {
  if (args.every((a) => !a) && !info.map) {
    return build(create, getScope, info.value);
  } else {
    const [value, isMap, isPure] = createFunc(create, getScope, info, args);
    return Object.assign(value, { isMap, isPure });
  }
};
