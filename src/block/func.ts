import build from '../build';
import { isResolved, memo } from '../utils';

import { staticSet } from './set';

const buildFunc = (getScope, info, args) => {
  const funcMap = (key = null) => (create, value) => {
    const argValues = [key, value];
    const getNewScope = memo(() =>
      args.reduce(
        (res, k, i) => (k ? staticSet(res, argValues[i], k) : res),
        getScope(),
      ),
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
    unresolved: true,
  };
};
