import build from './build';
import { fromJs } from './data';
import Box from './box';
import parse from './parse';
import process from './streams';
import { Data, Library, Source, StreamData } from './typings';

export { fromJs, toJs } from './data';
export { default as parse } from './parse';
export { default as process } from './streams';
export { Data, Source } from './typings';

const nilValue = { type: 'value', value: '' };
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
              if (d2.type !== 'box') return d2;
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

function maraca(source: Source): Data;
function maraca(source: Source, onData: (data: Data) => void): () => void;
function maraca(source: Source, library: Library): Data;
function maraca(
  source: Source,
  library: Library,
  onData: (data: Data) => void,
): () => void;
function maraca(...args) {
  const [source, library = {}, onData] =
    typeof args[1] === 'function' ? [args[0], {}, args[1]] : args;
  return process((baseCreate) => {
    const create = wrapCreate(baseCreate);
    const [start, modules] = Array.isArray(source) ? source : [source, {}];
    const parsedModules = {};
    const buildModule = (create, key, code) => {
      parsedModules[key] =
        parsedModules[key] || (typeof code === 'string' ? parse(code) : code);
      return build(
        create,
        {
          scope: [{ type: 'any', value: scope }],
          current: [
            { type: 'constant', value: { type: 'box', value: new Box() } },
          ],
        },
        parsedModules[key],
      );
    };
    const scope = {
      type: 'box',
      value: Box.fromPairs([
        ...Object.keys(library).map((k) => ({
          key: fromJs(k),
          value: create(
            typeof library[k] !== 'function'
              ? (set) => set(library[k])
              : (set, get) => {
                  const emit = ({ push, ...data }) =>
                    set({
                      ...data,
                      push: push && ((v) => push(get(v, true))),
                    });
                  const stop = library[k](emit);
                  return (dispose) => dispose && stop && stop();
                },
          ),
        })),
        ...Object.keys(modules).map((k) => ({
          key: fromJs(k),
          value: create((set, _, create) => {
            if (typeof modules[k] === 'function') {
              modules[k]().then((code) => set(buildModule(create, k, code)));
            } else {
              set(buildModule(create, k, modules[k]));
            }
          }),
        })),
      ]),
    };
    const stream = build(
      create,
      {
        scope: [{ type: 'any', value: scope }],
        current: [
          { type: 'constant', value: { type: 'box', value: new Box() } },
        ],
      },
      typeof start === 'string' ? parse(start) : start,
    );
    return create((set, get) => () => set(get(stream, true))).value;
  }, onData);
}

export default maraca;
