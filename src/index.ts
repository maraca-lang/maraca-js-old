import build from './build';
import {
  fromJs as fromJsBase,
  fromValue,
  toJs as toJsBase,
  toValue,
} from './data';
import listUtils from './list';
import parse from './parse';
import process from './process';
import { Config, Data, Source } from './typings';

export { unpack } from './data';
export { default as parse } from './parse';
export { Data, Source } from './typings';

export const fromJs = (value: any): Data => fromValue(fromJsBase(value));
export const toJs = (data: Data): any => toJsBase(toValue(data));

const wrapCreate = create => (run, ...args) => ({
  type: 'stream',
  value: create(({ get, output, create }) => {
    const resolve = data => {
      if (data.type === 'stream') return resolve(get(data.value));
      return data;
    };
    const resolveDeep = data =>
      get(
        create(({ get, output }) => {
          const map = d => {
            if (d.type === 'stream') return map(get(d.value));
            if (d.type !== 'list') return d;
            return listUtils.map(d, v => map(v));
          };
          return { initial: map(data), update: () => output(map(data)) };
        }),
      );
    return run({
      get: (data, deep) => (deep ? resolveDeep(data) : resolve(data)),
      output,
      create: wrapCreate(create),
    });
  }, ...args),
});

function maraca(source: Source): Data;
function maraca(source: Source, onData: (data: Data) => void): () => void;
function maraca(source: Source, config: Config): Data;
function maraca(
  source: Source,
  config: Config,
  onData: (data: Data) => void,
): () => void;
function maraca(...args) {
  const [source, { '@': interpret = [], '#': library = {} } = {}, onData] =
    typeof args[1] === 'function' ? [args[0], {}, args[1]] : args;
  const create = wrapCreate(process());
  const config = { '@': interpret, '#': {} };
  Object.keys(library).forEach(k => {
    config['#'][k] = create(
      typeof library[k] !== 'function'
        ? () => ({ initial: toValue(library[k]) })
        : ({ output, get }) => {
            let first = true;
            let initial = { type: 'nil' };
            const emit = ({ set, ...data }) => {
              const value = {
                ...toValue(data),
                set: set && (v => set(fromValue(get(v, true)))),
              };
              if (first) initial = value;
              else output(value);
            };
            const stop = library[k](emit);
            first = false;
            return { initial, stop };
          },
    );
  });
  const [start, modules] = Array.isArray(source) ? source : [source, {}];
  const buildModule = (create, code) =>
    build(
      config,
      create,
      {
        scope: [{ type: 'any', value: scope }],
        current: [{ type: 'constant', value: listUtils.empty() }],
      },
      typeof code === 'string' ? parse(code) : code,
    );
  const scope = listUtils.fromPairs(
    Object.keys(modules).map(k => ({
      key: fromJsBase(k),
      value: create(({ output, create }) => {
        if (typeof modules[k] === 'function') {
          modules[k]().then(code => output(buildModule(create, code)));
          return { initial: fromJsBase(null) };
        }
        return { initial: buildModule(create, modules[k]) };
      }),
    })),
  );
  const stream = build(
    config,
    create,
    {
      scope: [{ type: 'any', value: scope }],
      current: [{ type: 'constant', value: listUtils.empty() }],
    },
    typeof start === 'string' ? parse(start) : start,
  );
  const result = create(
    ({ get, output }) => {
      const run = () => get(stream, true);
      return { initial: run(), update: () => output(run()) };
    },
    data => onData(fromValue(data)),
  )!;
  result.value.observe();
  const initial = result.value.value;
  const stop = () => result.value.unobserve();
  if (!onData) {
    stop();
    return fromValue(initial);
  }
  onData(fromValue(initial));
  return stop;
}

export default maraca;
