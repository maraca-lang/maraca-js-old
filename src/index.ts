import build from './build';
import { fromJs } from './data';
import List from './list';
import parse from './parse';
import process from './streams';
import { Config, Data, Source, StreamData } from './typings';

export { fromJs, toJs } from './data';
export { default as parse } from './parse';
export { Data, Source } from './typings';

const wrapCreate = create => (run, ...args) =>
  ({
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
              return { type: 'list', value: d.value.map(v => map(v)) };
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
  } as StreamData);

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
  return process(baseCreate => {
    const create = wrapCreate(baseCreate);
    const config = { '@': interpret, '#': {} };
    Object.keys(library).forEach(k => {
      config['#'][k] = create(
        typeof library[k] !== 'function'
          ? () => ({ initial: library[k] })
          : ({ output, get }) => {
              let first = true;
              let initial = { type: 'value', value: '' };
              const emit = ({ push, ...data }) => {
                const value = {
                  ...data,
                  push: push && (v => push(get(v, true))),
                } as any;
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
          current: [
            { type: 'constant', value: { type: 'list', value: new List() } },
          ],
        },
        typeof code === 'string' ? parse(code) : code,
      );
    const scope = {
      type: 'list',
      value: List.fromPairs(
        Object.keys(modules).map(k => ({
          key: fromJs(k),
          value: create(({ output, create }) => {
            if (typeof modules[k] === 'function') {
              modules[k]().then(code => output(buildModule(create, code)));
              return { initial: fromJs(null) };
            }
            return { initial: buildModule(create, modules[k]) };
          }),
        })),
      ),
    };
    const stream = build(
      config,
      create,
      {
        scope: [{ type: 'any', value: scope }],
        current: [
          { type: 'constant', value: { type: 'list', value: new List() } },
        ],
      },
      typeof start === 'string' ? parse(start) : start,
    );
    return create(({ get, output }) => ({
      initial: get(stream, true),
      update: () => output(get(stream, true)),
    })).value;
  }, onData);
}

export default maraca;
