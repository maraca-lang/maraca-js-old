import assign from './assign';
import build from './build';
import { createStaticBlock } from './static';
import { streamMap } from './util';

const getStatic = (keys, arg) =>
  keys.reduce((res, k, i) => {
    if (!k || !(k.type === 'constant' && k.value.type === 'value')) return res;
    return { ...res, [k.value.value]: { type: 'map', arg, map: (x) => x[i] } };
  }, {});

const getCompiled = (create, keys, bodyKey, bodyValue) => {
  const trace = {};
  if (
    keys
      .filter((a) => a)
      .every((a) => a.type === 'constant' && a.value.type !== 'block')
  ) {
    const ctx = {
      scope: createStaticBlock('any', getStatic(keys, trace)),
      current: createStaticBlock('any'),
    };
    const compileBody = (body) => {
      const result = build(create, ctx, body);
      if (result.type === 'constant') return () => result.value;
      if (result.type === 'map' && result.arg === trace) return result.map;
    };
    return {
      key: bodyKey === true ? (x) => x[0] : bodyKey && compileBody(bodyKey),
      value: compileBody(bodyValue),
    };
  }
};

export default (create, context, info, args) => {
  const compiled = getCompiled(create, args, info.key, info.value);
  if (compiled) {
    if (info.map) {
      if (compiled.key && compiled.value) {
        return [
          (value, key) => [
            compiled.value([key, value], (x) => x),
            compiled.key([key, value], (x) => x),
          ],
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

  const scope = context.scope;
  const funcMap = (current = createStaticBlock(), key = null) => (
    create,
    value,
  ) => {
    const argValues = [key, value];
    const ctx = { scope, current };
    args.forEach((k, i) => {
      if (k) {
        const prev = ctx.scope.value;
        ctx.scope = {
          ...ctx.scope,
          value: create(
            streamMap((get) =>
              assign(true, false, false)([prev, argValues[i], k.value], get),
            ),
          ),
        };
      }
    });
    ctx.scope = {
      ...ctx.scope,
      static: {
        ...ctx.scope.static,
        ...getStatic(args, { type: 'any', value: argValues }),
      },
    };
    return [
      build(create, ctx, info.value).value,
      info.key === true ? key : info.key && build(create, ctx, info.key).value,
    ];
  };
  return [info.map ? funcMap : funcMap(), info.map];
};
