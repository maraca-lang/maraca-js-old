import build from '../build';
import { fromObj, isResolved, keysToObject } from '../utils';

import { staticSet } from './set';

const getCompiled = (keys, map, bodyKey, bodyValue) => {
  const trace = {};
  if (keys.filter((a) => a).every((a) => a.type === 'value')) {
    const scope = {
      type: 'block',
      value: fromObj(
        keysToObject(
          keys,
          (k, i) =>
            k ? { type: 'map', arg: trace, map: (x) => x[i] } : undefined,
          (k) => k.value,
        ),
      ),
    };
    const compileBody = (body) => {
      const result = build(null, () => scope, body);
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

const buildFunc = (getScope, info, args) => {
  try {
    const compiled = getCompiled(args, info.map, info.key, info.value);
    if (compiled) {
      if (info.map) {
        if (compiled.key && compiled.value) {
          if (compiled.key === true) {
            return Object.assign(
              (key) => (_, value) => compiled.value([key, value], (x) => x),
              { isMap: true, isIndex: true, isPure: true },
            );
          }
          return Object.assign(
            (key) => (_, value) => ({
              key: compiled.key([key, value], (x) => x),
              value: compiled.value([key, value], (x) => x),
            }),
            { isMap: true, isPure: true },
          );
        }
      } else {
        if (compiled.value) {
          return Object.assign(
            (_, value) => compiled.value([null, value], (x) => x),
            { isMap: false, isPure: true },
          );
        }
      }
    }
  } catch {}

  const funcMap = (key = null) => (create, value) => {
    const argValues = [key, value];
    const getNewScope = () =>
      args.reduce(
        (res, k, i) => (k ? staticSet(res, argValues[i], k) : res),
        getScope(),
      );
    const valueResult = build(create, getNewScope, info.value);
    if (!info.map || !info.key) return valueResult;
    return {
      key: info.key === true ? key : build(create, getNewScope, info.key),
      value: valueResult,
    };
  };
  return Object.assign(info.map ? funcMap : funcMap(), {
    isMap: info.map,
    isIndex: !info.key,
  });
};

export default (block, create, getScope, info, args) => {
  if (!info.map && args.every((a) => !a)) {
    const value = build(create, getScope, info.value);
    if (!value) return null;
    return {
      ...block,
      func: value,
      ...(isResolved(value) ? {} : { unresolved: true }),
    };
  }
  if (!create) return null;
  const func = buildFunc(getScope, info, args);
  return {
    ...block,
    func,
    ...(func.isPure ? {} : { unresolved: true }),
  };
};
