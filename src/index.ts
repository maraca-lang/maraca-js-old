import { printBlock, resolveDeep } from './block/set';
import build from './build';
import parse from './parse';
import { Data, Source } from './typings';
import {
  createBlock,
  isResolved,
  memo,
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

function maraca(source: Source): Data;
function maraca(source: Source, onData: (data: Data) => void): () => void;
function maraca(...args) {
  const [source, onData] = args;
  return process((create) => {
    const valueToBuild = (value) => {
      if (typeof value === 'function') {
        return {
          type: 'built',
          info: { value: { type: 'stream', value: create(value) } },
        };
      }
      if (typeof value === 'string' || value.__AST) {
        return typeof value === 'string' ? parse(value) : value;
      }
      return objToBuild(value);
    };
    const objToBuild = (source) => {
      const block = {
        type: 'block',
        info: { bracket: '[' },
        nodes: Object.keys(source).map((k) => ({
          type: 'set',
          nodes: [
            valueToBuild(source[k]),
            { type: 'value', info: { value: k } },
          ],
        })),
      };
      if (source[''] === undefined) return block;
      return {
        type: 'combine',
        nodes: [{ type: 'value', info: { value: '' } }, block],
      };
    };
    const result = build(
      create,
      memo(() => createBlock()),
      objToBuild(
        typeof source === 'string' || source.__AST ? { '': source } : source,
      ),
    );
    return create(streamMap((get) => resolve(result, get)));
  }, onData);
}

export default maraca;
