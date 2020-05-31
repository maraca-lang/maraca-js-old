import build from '../build';
import { fromObj, isResolved, keysToObject } from '../utils';

import { staticSet } from './set';

const buildFunc = (getScope, info, args) => {
  if (args.filter((a) => a).every((a) => a.type === 'value')) {
    const trace = {};
    const scope = fromObj(
      keysToObject(
        args,
        (k, i) =>
          k ? { type: 'map', arg: trace, value: (x) => x[i] } : undefined,
        (k) => k.value,
      ),
    );
    const compile = (node) => {
      const result = build(null, () => scope, node);
      if (result) {
        if (isResolved(result)) return () => result;
        if (result.type === 'map' && result.arg === trace) return result.value;
      }
    };
    const valueMap = compile(info.value);
    if (valueMap) {
      if (info.map) {
        if (!info.key) {
          return Object.assign(
            (key) => (_, value) => valueMap([key, value], (x) => x),
            { isMap: true, isUnpack: true, isPure: true },
          );
        }
        const keyMap = info.key === true ? (x) => x[0] : compile(info.key);
        if (keyMap) {
          return Object.assign(
            (key) => (_, value) => ({
              key: keyMap([key, value], (x) => x),
              value: valueMap([key, value], (x) => x),
            }),
            { isMap: true, isPure: true },
          );
        }
      } else {
        return Object.assign((_, value) => valueMap([null, value], (x) => x), {
          isMap: false,
          isPure: true,
        });
      }
    }
  }

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
    isUnpack: !info.key,
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
