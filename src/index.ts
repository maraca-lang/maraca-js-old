import build from './build';
import parse from './parse';
import resolve from './resolve';
import { fromPairs } from './utils/block';
import { fromJs } from './utils/data';
import { streamMap } from './utils/misc';
import process from './utils/streams';
import { Data, Source } from './utils/typings';

export { default as parse } from './parse';
export { fromJs, print, toJs } from './utils/data';
export { streamMap } from './utils/misc';
export { default as process } from './utils/streams';
export { Data, Source } from './utils/typings';

const buildModuleLayer = (create, modules, getScope, path) =>
  Object.keys(modules).reduce(
    (res, k) => ({
      ...res,
      [k]:
        typeof modules[k] === 'function'
          ? { type: 'stream', value: create(modules[k]) }
          : typeof modules[k] === 'string' || modules[k].__AST
          ? {
              type: 'stream',
              value: create((set, _, create) =>
                set(
                  build(
                    create,
                    () => getScope(path),
                    typeof modules[k] === 'string'
                      ? parse(modules[k])
                      : modules[k],
                  ),
                ),
              ),
            }
          : buildModuleLayer(create, modules[k], getScope, [...path, k]),
    }),
    { __MODULES: true },
  );

function maraca(source: Source): Data;
function maraca(source: Source, onData: (data: Data) => void): () => void;
function maraca(...args) {
  const [source, onData] = args;
  return process((create) => {
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
      value: fromPairs(
        Object.keys(moduleLayer).map((k) => ({
          key: fromJs(k),
          value: moduleLayer[k].__MODULES
            ? moduleLayer[k][''] || modulesToBlock(moduleLayer[k])
            : moduleLayer[k],
        })),
      ),
    });
    return create(
      streamMap((get) =>
        resolve(modules[''] || modulesToBlock(modules), get, true),
      ),
    );
  }, onData);
}

export default maraca;
