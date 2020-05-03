import assign from './assign';
import Block from './block';
import build from './build';
import { fromJs } from './data';
import { createStaticBlock } from './static';
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
    const currentTrace = createStaticBlock();
    const ctx = {
      scope: createStaticBlock(
        args.reduce((res, a, i) => {
          if (!a) return res;
          return {
            ...res,
            [a.value.value || '']: {
              type: 'map',
              arg: argTrace,
              map: (x) => x.value.get(fromJs(i + 1)),
            },
          };
        }, {}),
      ),
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
                        ? compiledBody.key(
                            {
                              type: 'block',
                              value: Block.fromArray([key, value]),
                            },
                            get,
                          )
                        : key,
                      value: compiledBody.value(
                        {
                          type: 'block',
                          value: Block.fromArray([key, value]),
                        },
                        get,
                      ),
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
                  compiledBody.value(
                    {
                      type: 'block',
                      value: Block.fromArray([
                        { type: 'value', value: '' },
                        get(value),
                      ]),
                    },
                    get,
                  ),
                ),
              ),
            ],
        info.map,
        true,
      ];
    }
  }

  const argValues = args.map((a) => a && a.value);
  const scope = context.scope;
  const funcMap = (current = createStaticBlock(), key = null) => (
    create,
    value,
  ) => {
    const values = [key, value];
    const ctx = { scope, current };
    argValues.forEach((key, i) => {
      if (key) {
        const prev = ctx.scope.value;
        ctx.scope = {
          type: 'any',
          value: create(
            streamMap((get) =>
              assign(true, false, false)([prev, values[i], key], get),
            ),
          ),
        };
      }
    });
    const result = build(create, ctx, info.body);
    return [result.value, ctx.current.value];
  };
  return [info.map ? funcMap : funcMap(), info.map];
};
