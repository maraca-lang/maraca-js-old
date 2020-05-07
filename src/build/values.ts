import Block from '../block';
import build from '../build';
import { combineConfig, combineRun } from '../combine';
import maps from '../maps';
import parse from '../parse';
import { streamMap } from '../util';

import mergeStatic from './static';

export default (create, type, info, args) => {
  if (type === 'nil' || (type === 'value' && !info.value) || type === 'error') {
    return { type: 'value', value: '' };
  }

  if (type === 'value') {
    return { type: 'value', value: info.value };
  }

  if (type === 'join') {
    return args.reduce((a1, a2, i) =>
      mergeStatic(create, [a1, a2], (args, get) =>
        maps[''](
          args.map((a) => get(a)),
          info.space[i - 1],
        ),
      ),
    );
  }

  if (type === 'combine') {
    return args.reduce((a1, a2) =>
      mergeStatic(create, [a1, a2], combineConfig, combineRun),
    );
  }

  if (type === 'map') {
    const { map, deepArgs = [] } =
      typeof maps[info.func] === 'function'
        ? { map: maps[info.func] }
        : maps[info.func];
    return mergeStatic(create, args, (args, get) =>
      map(args.map((a, i) => get(a, deepArgs[i]))),
    );
  }

  if (type === 'eval') {
    return create(
      streamMap((get, create) => {
        try {
          const code = get(args[0]);
          const arg = get(args[1]);
          const newScope = { type: 'block', value: new Block() };
          return build(
            create,
            () => newScope,
            arg.type === 'block' ? arg : { type: 'block', value: new Block() },
            parse(code.type === 'value' ? code.value : ''),
          );
        } catch (e) {
          console.log(e.message);
          return { type: 'value', value: '' };
        }
      }),
    );
  }

  if (type === 'trigger') {
    return create((set, get) => {
      let trigger;
      return () => {
        const newTrigger = get(args[0], true);
        if (trigger !== newTrigger && newTrigger.value) {
          set({ ...get(args[1], true, true) });
        }
        trigger = newTrigger;
      };
    });
  }
};
