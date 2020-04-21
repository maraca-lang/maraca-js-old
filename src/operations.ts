import build, { pushable, streamMap } from './build';
import Block from './block';
import parse from './parse';

const snapshot = (create, { push, ...value }) => {
  const result =
    value.type !== 'block'
      ? value
      : {
          type: 'block',
          value: Block.fromPairs(
            value.value.toPairs().map(({ key, value }) => ({
              key,
              value: snapshot(create, value),
            })),
          ),
        };
  return push ? create(pushable(result), true) : result;
};

export default (type, create, nodes) => {
  if (type === 'trigger') {
    return create((set, get) => {
      let trigger;
      return () => {
        const newTrigger = get(nodes[0], true);
        if (trigger !== newTrigger && newTrigger.value) {
          set({ ...get(nodes[1]) });
        }
        trigger = newTrigger;
      };
    });
  }

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
          scope: {
            type: 'constant',
            value: { type: 'block', value: new Block() },
          },
          current: {
            type: 'any',
            value: nodes[1] || { type: 'value', value: '' },
          },
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
};
