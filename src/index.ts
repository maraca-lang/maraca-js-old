import build from './build';
import { fromJs } from './data';
import Block from './block';
import parse from './parse';
import process from './streams';
import { Data, Source, StreamData } from './typings';

export { default as Block } from './block';
export { fromJs, print, toJs } from './data';
export { default as parse } from './parse';
export { default as process } from './streams';
export { Data, Source } from './typings';

const nilValue = { type: 'value', value: '' };
const hasStream = (data) =>
  data.value
    .toPairs()
    .some(
      (x) =>
        x.value.type === 'stream' ||
        (x.value.type === 'block' && hasStream(x.value)),
    );
const wrapCreate = (create) => (run, ...args) =>
  ({
    type: 'stream',
    value: create((set, get, create) => {
      const resolve = (data) => {
        const d = data || nilValue;
        if (d.type === 'stream') return resolve(get(d.value));
        return d;
      };
      const resolveDeep = (data) =>
        get(
          create((set, get) => {
            const map = (d) => {
              const d2 = d || nilValue;
              if (d2.type === 'stream') return map(get(d2.value));
              if (d2.type !== 'block' || !hasStream(d2)) return d2;
              return { ...d2, value: d2.value.map((v) => map(v)) };
            };
            return () => set(map(data));
          }),
        );
      return run(
        set,
        (data, deep) => (deep ? resolveDeep(data) : resolve(data)),
        wrapCreate(create),
      );
    }, ...args),
  } as StreamData);

const buildModuleLayer = (create, modules, getScope, path) =>
  Object.keys(modules).reduce(
    (res, k) => ({
      ...res,
      [k]:
        typeof modules[k] === 'function'
          ? create(modules[k])
          : typeof modules[k] === 'string' || modules[k].__AST
          ? create((set, _, create) =>
              set(
                build(
                  create,
                  {
                    scope: [{ type: 'any', value: getScope(path) }],
                    current: [
                      {
                        type: 'constant',
                        value: { type: 'block', value: new Block() },
                      },
                    ],
                  },
                  typeof modules[k] === 'string'
                    ? parse(modules[k])
                    : modules[k],
                ),
              ),
            )
          : buildModuleLayer(create, modules[k], getScope, [...path, k]),
    }),
    { __MODULES: true },
  );

function maraca(source: Source): Data;
function maraca(source: Source, onData: (data: Data) => void): () => void;
function maraca(...args) {
  const [source, onData] = args;
  return process((baseCreate) => {
    const create = wrapCreate(baseCreate);
    const modules = buildModuleLayer(
      create,
      typeof source === 'string' || source.__AST ? { '': source } : source,
      (path) =>
        modulesToBlock(
          path.reduce((res, k) => ({ ...res, ...res[k] }), modules),
        ),
      [],
    );
    const modulesToBlock = ({ __MODULES, ...moduleLayer }) => ({
      type: 'block',
      value: Block.fromPairs(
        Object.keys(moduleLayer).map((k) => ({
          key: fromJs(k),
          value: moduleLayer[k].__MODULES
            ? moduleLayer[k][''] || modulesToBlock(moduleLayer[k])
            : moduleLayer[k],
        })),
      ),
    });
    return create((set, get) => () =>
      set(get(modules[''] || modulesToBlock(modules), true)),
    ).value;
  }, onData);
}

export default maraca;
