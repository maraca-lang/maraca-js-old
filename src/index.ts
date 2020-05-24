import { printBlock, resolveDeep } from './block/set';
import build from './build';
import parse from './parse';
import { Data, Source } from './typings';
import {
  fromObj,
  isResolved,
  keysToObject,
  printValue,
  process,
  resolveType,
  streamMap,
} from './utils';

export { default as parse } from './parse';
export { Data, Source } from './typings';
export { fromJs, process, streamMap, toJs } from './utils';

export const resolve = (data, get) => {
  const v = resolveType(data, get);
  if (isResolved(v)) return v;
  return { ...v, value: resolveDeep(v.value, get) };
};

export const print = ({ type, value }, get) => {
  if (type === 'value') return printValue(value);
  return printBlock(value, get);
};

const buildModuleLayer = (create, modules, getScope, path) =>
  keysToObject(
    Object.keys(modules),
    (k) =>
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
    (k) => k,
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
        ).value,
      [],
    );
    const modulesToBlock = ({ __MODULES, ...moduleLayer }) => ({
      type: 'block',
      value: fromObj(
        keysToObject(
          Object.keys(moduleLayer).filter((x) => x !== ''),
          (k) =>
            moduleLayer[k].__MODULES
              ? moduleLayer[k][''] || modulesToBlock(moduleLayer[k])
              : moduleLayer[k],
        ),
      ),
    });
    return create(
      streamMap((get) => resolve(modules[''] || modulesToBlock(modules), get)),
    );
  }, onData);
}

export default maraca;
