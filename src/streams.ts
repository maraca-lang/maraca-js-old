import build, { streamMap } from './build';
import { fromJs, fromJsFunc, fromValue, toJs, toValue } from './data';
import listUtils from './list';
import parse from './parse';

const snapshot = (create, { set, ...value }, index?) => {
  const result =
    value.type !== 'list'
      ? value
      : listUtils.fromPairs(
          listUtils.toPairs(value).map(({ key, value }, i) => ({
            key,
            value: snapshot(create, value, [...(index || [0]), i]),
          })),
        );
  return index ? create(result, null, index) : result;
};

export default (type, info, config, create, nodes) => {
  if (type === 'push') {
    return create(({ get }) => {
      let source = get(nodes[0]);
      return {
        initial: { type: 'nil' },
        update: () => {
          const dest = get(nodes[1]);
          const newSource = get(nodes[0]);
          if (dest.set && source !== newSource) {
            dest.set(snapshot(create, get(nodes[0], true)));
          }
          source = newSource;
        },
      };
    });
  }

  if (type === 'interpret') {
    const func = config['@'] && config['@'][info.level - 1];
    if (!func) return { type: 'nil' };
    return create(fromJsFunc(nodes[0], func, true));
  }

  if (type === 'eval') {
    return create(
      streamMap(([code], create) => {
        const subContext = {
          scope: [{ type: 'any', value: nodes[1] }],
          current: [{ type: 'constant', value: listUtils.empty() }],
        };
        let parsed = { type: 'nil' };
        try {
          parsed = parse(code.type === 'value' ? code.value : '');
        } catch (e) {
          console.log(e.message);
        }
        return build(config, create, subContext, parsed);
      })([nodes[0]]),
    );
  }

  if (type === 'trigger') {
    return create(({ get, output }) => {
      let values = nodes.map(a => get(a));
      return {
        initial: values[1],
        update: () => {
          const newValues = nodes.map(a => get(a));
          if (values[0] !== newValues[0]) output({ ...newValues[1] });
          values = newValues;
        },
      };
    });
  }

  if (type === 'library') {
    return create(({ get, output, create }) => {
      const run = () => {
        const resolved = get(nodes[0]);
        const v = resolved.type !== 'list' && toJs(resolved);
        if (typeof v === 'number' && Math.floor(v) === v) {
          return listUtils.fromArray(
            Array.from({ length: v }).map((_, i) => fromJs(i + 1)),
          );
        }
        if (typeof v === 'string') {
          const func = config['#'] && config['#'][v];
          if (!func) return { type: 'nil' };
          if (typeof func !== 'function') {
            return create(() => ({ initial: toValue(func) }));
          }
          return create(({ output, get }) => {
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
            const stop = func(emit);
            first = false;
            return { initial, stop };
          });
        }
        const list = get(nodes[0], true);
        return fromJs(
          listUtils.toPairs(list).filter(d => d.value.type !== 'nil').length,
        );
      };
      return { initial: run(), update: () => output(run()) };
    });
  }
};
