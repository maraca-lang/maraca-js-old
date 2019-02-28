import build from './build';
import { fromJs } from './data';
import parse from './parse';
import process from './process';
import { Config, Data, Source } from './typings';

export { compare, fromJs, toJs } from './data';
export { default as parse } from './parse';
export { Data, Source } from './typings';

function maraca(source: Source): Data;
function maraca(source: Source, output: (data: Data) => void): void;
function maraca(source: Source, config: Config): Data;
function maraca(
  source: Source,
  config: Config,
  output: (data: Data) => void,
): void;
function maraca(...args) {
  const [source, config = {}, output] =
    typeof args[1] === 'function' ? [args[0], {}, args[1]] : args;
  const create = process();
  const [start, modules] = Array.isArray(source) ? source : [source, {}];
  const buildModule = (create, code) =>
    build(
      config,
      create,
      {
        scope: [scope],
        current: [{ type: 'list', value: { indices: [], values: {} } }],
      },
      typeof code === 'string' ? parse(code) : code,
    );
  const scope = {
    type: 'list',
    value: {
      indices: [],
      values: Object.keys(modules).reduce(
        (res, k) => ({
          ...res,
          [k]: {
            key: fromJs(k),
            value: create(({ output, create }) => {
              if (typeof modules[k] === 'function') {
                modules[k]().then(code => output(buildModule(create, code)));
                return { initial: fromJs(null) };
              }
              return { initial: buildModule(create, modules[k]) };
            }),
          },
        }),
        {},
      ),
    },
  };
  const stream = build(
    config,
    create,
    {
      scope: [scope],
      current: [{ type: 'list', value: { indices: [], values: {} } }],
    },
    typeof start === 'string' ? parse(start) : start,
  );
  const result = create(
    ({ get, output }) => {
      const run = () => get(stream, true);
      return { initial: run(), update: () => output(run()) };
    },
    data => output(data),
  )!;
  const obj = {};
  result.value.observe(obj);
  const initial = result.value.value;
  const stop = () => result.value.unobserve(obj);
  if (!output) {
    stop();
    return initial;
  }
  output(initial);
  return stop;
}

export default maraca;
