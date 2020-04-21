import assign from './assign';
import Block from './block';
import build from './build';
import { fromJs } from './data';
import { streamMap } from './util';

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

export default (create, context, info, args) => {
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
      context.current = {
        type: 'any',
        items: { ...context.current.items },
        value: create(
          streamMap(([current]) => ({
            type: 'block',
            value: ((current && current.value) || new Block()).setFunc(
              info.map
                ? (create, block) => [
                    create(
                      streamMap(([y]) => {
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
                      })([block], [true]),
                    ),
                  ]
                : (create, value) => [
                    create(
                      streamMap(([y]) =>
                        compiledBody.value({
                          type: 'block',
                          value: Block.fromArray([
                            { type: 'value', value: '' },
                            y,
                          ]),
                        }),
                      )([value]),
                    ),
                  ],
              info.map,
              !!args[1],
              true,
            ),
          }))([context.current.value]),
        ),
      };
      return { type: 'constant', value: { type: 'value', value: '' } };
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
        subContext.scope = {
          type: 'any',
          value: create(
            assign(
              [subContext.scope.value, values[i], key],
              true,
              false,
              false,
            ),
          ),
        };
      }
    });
    const result = build(subCreate, subContext, info.body);
    return [result.value, subContext.scope.value, subContext.current.value];
  };
  context.current = {
    type: 'any',
    items: { ...context.current.items },
    value: create(
      streamMap(([current]) => ({
        type: 'block',
        value: ((current && current.value) || new Block()).setFunc(
          info.map ? funcMap : funcMap(),
          info.map,
          !!args[1],
        ),
      }))([context.current.value]),
    ),
  };
  return { type: 'constant', value: { type: 'value', value: '' } };
};
