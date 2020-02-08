import build, { pushable, streamMap } from './build';
import { fromJs, fromJsFunc, toIndex, toJs } from './data';
import List from './list';
import parse from './parse';

const snapshot = (create, { push, ...value }, withPush = true) => {
  const result =
    value.type !== 'list'
      ? value
      : {
          type: 'list',
          value: List.fromPairs(
            value.value.toPairs().map(({ key, value }) => ({
              key,
              value: snapshot(
                create,
                value,
                !(key.type === 'value' && toIndex(key.value)),
              ),
            })),
          ),
        };
  return withPush ? create(pushable(result), true) : result;
};

export default (type, info, config, create, nodes) => {
  if (type === 'push') {
    return create((_, get, create) => {
      let source;
      return () => {
        const dest = get(nodes[1]);
        const newSource = get(nodes[0]);
        if (source && dest.push && source !== newSource) {
          dest.push(snapshot(create, get(nodes[0], true)));
        }
        source = newSource;
      };
    });
  }

  if (type === 'interpret') {
    const func = config['@'] && config['@'][info.level - 1];
    if (!func) return { type: 'value', value: '' };
    return create(fromJsFunc(nodes[0], func, true));
  }

  if (type === 'eval') {
    return create(
      streamMap(([code], create) => {
        const subContext = {
          scope: [{ type: 'any', value: nodes[1] }],
          current: [
            { type: 'constant', value: { type: 'list', value: new List() } },
          ],
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
    return create((set, get) => {
      let values = [];
      return () => {
        const newValues = nodes.map(a => get(a));
        if (values[0] !== newValues[0]) set({ ...newValues[1] });
        values = newValues;
      };
    });
  }

  if (type === 'library') {
    return create((set, get) => {
      const run = () => {
        const resolved = get(nodes[0]);
        const v = resolved.type !== 'list' && toJs(resolved);
        if (typeof v === 'number' && Math.floor(v) === v) {
          return {
            type: 'list',
            value: List.fromArray(
              Array.from({ length: v }).map((_, i) => fromJs(i + 1)),
            ),
          };
        }
        if (typeof v === 'string') {
          return (
            (config['#'] && config['#'][v]) || { type: 'value', value: '' }
          );
        }
        const list = get(nodes[0], true);
        return fromJs(list.toPairs().filter(d => d.value).length);
      };
      return () => set(run());
    });
  }
};
