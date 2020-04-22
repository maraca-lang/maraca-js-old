import assign from './assign';
import Block from './block';
import build from './build';
import { fromJs } from './data';
import { streamMap } from './streams';

const getCompiledMap = (create, context, node, argTrace) => {
  const compiled = build(create, context, node);
  if (compiled.type === 'constant') return () => compiled.value;
  if (compiled.type === 'map' && compiled.arg === argTrace) return compiled.map;
  return null;
};
const compileFuncBody = (create, context, body, isMap, argTrace) => {
  if (
    isMap &&
    body.type === 'assign' &&
    body.nodes[1] === null &&
    body.nodes[0].type === 'block' &&
    body.nodes[0].info.bracket === '[' &&
    body.nodes[0].nodes.length === 1
  ) {
    const value = getCompiledMap(
      create,
      context,
      body.nodes[0].nodes[0],
      argTrace,
    );
    return value && { value, index: true };
  }
  if (isMap && body.type === 'assign' && body.nodes[0] && body.nodes[1]) {
    const maps = body.nodes.map((n) =>
      getCompiledMap(create, context, n, argTrace),
    );
    return maps.every((c) => c) && { value: maps[0], key: maps[1] };
  }
  const value = getCompiledMap(create, context, body, argTrace);
  return value && { value };
};

const getFuncArgs = (create, context, info, args) => {
  if (args.every((a) => !a) && !info.map) {
    const value = build(create, context, info.body).value;
    return [value];
  }

  if (
    args
      .filter((a) => a)
      .every((a) => a.type === 'constant' && a.value.type !== 'block')
  ) {
    const argTrace = { type: 'data', value: { type: 'value', value: '' } };
    const currentTrace = {
      type: 'constant',
      value: { type: 'block', value: new Block() },
    };
    const ctx = {
      scope: {
        type: 'any',
        items: args.reduce(
          (res, a, i) =>
            a
              ? {
                  ...res,
                  [a.value.value || '']: {
                    type: 'map',
                    arg: argTrace,
                    map: (x) => x.value.get(fromJs(i + 1)),
                  },
                }
              : res,
          {},
        ),
        value: { type: 'nil ' },
      },
      current: currentTrace,
    };
    const compiledBody = compileFuncBody(
      create,
      ctx,
      info.body,
      info.map,
      argTrace,
    );
    if (compiledBody && ctx.current === currentTrace) {
      return [
        info.map
          ? (create, block) => [
              create(
                streamMap((get) => {
                  const y = get(block, true);
                  const mapped = y.value
                    .toPairs()
                    .filter((d) => d.value.value)
                    .map(({ key, value }) => ({
                      key: compiledBody.key
                        ? compiledBody.key({
                            type: 'block',
                            value: Block.fromArray([key, value]),
                          })
                        : key,
                      value: compiledBody.value({
                        type: 'block',
                        value: Block.fromArray([key, value]),
                      }),
                    }))
                    .filter((d) => d.value.value);
                  return {
                    type: 'block',
                    value: Block.fromPairs(
                      compiledBody.index
                        ? mapped.map((d, i) => ({
                            key: fromJs(i + 1),
                            value: d.value,
                          }))
                        : mapped,
                    ),
                  };
                }),
              ),
            ]
          : (create, value) => [
              create(
                streamMap((get) =>
                  compiledBody.value({
                    type: 'block',
                    value: Block.fromArray([
                      { type: 'value', value: '' },
                      get(value),
                    ]),
                  }),
                ),
              ),
            ],
        info.map,
        true,
      ];
    }
  }

  const argValues = args.map((a) => a && a.value);
  const scope = context.scope.value;
  const funcMap = (
    funcScope = scope,
    funcCurrent = { type: 'block', value: new Block() },
    key = null,
  ) => (subCreate, value) => {
    const values = [key, value];
    const subContext = {
      scope: { type: 'any', value: funcScope },
      current: { type: 'any', value: funcCurrent },
    };
    argValues.forEach((key, i) => {
      if (key) {
        const prev = subContext.scope.value;
        subContext.scope = {
          type: 'any',
          value: create((set, get) => () =>
            set(assign(get, [prev, values[i], key], true, false, false)),
          ),
        };
      }
    });
    const result = build(subCreate, subContext, info.body);
    return [result.value, subContext.scope.value, subContext.current.value];
  };
  return [info.map ? funcMap : funcMap(), info.map];
};

export default (create, context, info, args) => {
  const funcArgs = getFuncArgs(create, context, info, args);
  const currentValue = context.current.value;
  context.current = {
    type: 'any',
    items: { ...context.current.items },
    value: create(
      streamMap((get) => ({
        type: 'block',
        value: get(currentValue).value.setFunc(...funcArgs),
      })),
    ),
  };
  return { type: 'constant', value: { type: 'value', value: '' } };
};
