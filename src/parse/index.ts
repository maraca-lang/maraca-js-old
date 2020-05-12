import { AST } from '../utils/typings';

import loadInner, { dedent } from './inner';
import loadOuter from './outer';

let inner;
let outer;

const parseString = (s) =>
  dedent(s)
    .replace(/\n/g, '￿')
    .replace(/\\(￿| )/g, '\n')
    .replace(/\\(.)/g, (_, m) => m)
    .replace(/(\s|￿)*(\n|￿)(\s|￿)*(\n|￿)(\s|￿)*/g, '\n\n')
    .replace(/(￿| |\t)+/g, ' ');

const parseParts = (parts, text = false) => {
  const mapped = parts.map((p) => {
    if (p.type === 'part') return p;
    const nodes = p.nodes.reduce((res, x) => {
      if (Array.isArray(x)) return [...res, ...parseParts(x)];
      return [...res, ...parseParts(x.nodes, true)];
    }, []);
    let i = nodes.length - 1;
    while (i >= 0 && nodes[i].type === 'nil') {
      nodes.pop();
      i--;
    }
    return { ...p, nodes: nodes };
  });
  if (text) {
    const result = mapped.map((p) => {
      if (p.type !== 'part') return p;
      return {
        type: 'value',
        info: {
          value: parseString(p.info.value)
            .replace(/(\s)'/g, (_, m) => `${m}‘`)
            .replace(/'/g, '’')
            .replace(/(\s)"/g, (_, m) => `${m}“`)
            .replace(/"/g, '”'),
          multi: true,
        },
        start: p.start,
        end: p.end,
      };
    });
    result[0].info = {
      ...(result[0].info || {}),
      first: true,
    };
    result[result.length - 1].info = {
      ...(result[result.length - 1].info || {}),
      last: true,
    };
    return result;
  }
  const offsets = [] as any[];
  const script = mapped.reduce((res, part, i) => {
    offsets.push([res.length, part.start - res.length]);
    return `${res}${part.type === 'part' ? part.info.value : `￿${i}￿X`}`;
  }, '');
  try {
    return [inner(script.replace(/￿>/g, '/>'), mapped, offsets)];
  } catch (error) {
    return [{ type: 'error', info: { nodes: mapped, message: error.message } }];
  }
};

export default (script): AST => {
  if (!inner) inner = loadInner();
  if (!outer) outer = loadOuter();
  return { ...parseParts(outer(script))[0], __AST: true };
};
