import build, { pushable, streamMap } from './build';
import { toIndex } from './data';
import Block from './block';
import parse from './parse';

const snapshot = (create, { push, ...value }, withPush = true) => {
  const result =
    value.type !== 'block'
      ? value
      : {
          type: 'block',
          value: Block.fromPairs(
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

export default (type, create, nodes) => {
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

  if (type === 'eval') {
    return create(
      streamMap(([code], create) => {
        const subContext = {
          scope: [{ type: 'any', value: nodes[1] }],
          current: [
            { type: 'constant', value: { type: 'block', value: new Block() } },
          ],
        };
        let parsed = { type: 'nil' };
        try {
          parsed = parse(code.type === 'value' ? code.value : '');
        } catch (e) {
          console.log(e.message);
        }
        return build(create, subContext, parsed);
      })([nodes[0]]),
    );
  }

  if (type === 'trigger') {
    return create((set, get) => {
      let values = [];
      return () => {
        const newValues = nodes.map((a) => get(a));
        if (values[0] !== newValues[0]) set({ ...newValues[1] });
        values = newValues;
      };
    });
  }
};
