import * as ohm from 'ohm-js';

import { AST } from '../typings';

import grammar from './grammar';

let g;
let s;

const loadSemantics = () => {
  g = ohm.grammar(grammar);
  s = g.createSemantics();

  const funcAst = (key, value, body, map, first, last) => ({
    type: 'func',
    nodes: [key && key.ast, value && value.ast],
    info: { body: body?.ast || { type: 'nil' }, map },
    start: first.source.startIdx,
    end: last.source.endIdx,
  });
  const assignAst = (value, key, first, last) => ({
    type: 'assign',
    nodes: [value, key],
    start: first.source.startIdx,
    end: last.source.endIdx,
  });
  const mapAst = (arg1, func, arg2) => ({
    type: 'map',
    nodes: [arg1.ast, arg2.ast],
    info: { func: func.sourceString },
    start: arg1.source.startIdx,
    end: arg2.source.endIdx,
  });
  const blockAst = (a, b, first, last) => {
    const items = b.ast.reduce((res, x) => [...res, ...x], [...a.ast]);
    let i = items.length - 1;
    while (i >= 0 && items[i].type === 'nil') {
      items.pop();
      i--;
    }
    return {
      type: 'block',
      nodes: items,
      info: { bracket: first.sourceString },
      start: first.source.startIdx,
      end: last.source.endIdx,
    };
  };

  const parseString = (s) =>
    dedent(s)
      .replace(/\n/g, '￿')
      .replace(/\\(￿| )/g, '\n')
      .replace(/\\(.)/g, (_, m) => m)
      .replace(/(\s|￿)*(\n|￿)(\s|￿)*(\n|￿)(\s|￿)*/g, '\n\n')
      .replace(/(￿| |\t)+/g, ' ');

  const dedent = (str) => {
    let s = str;
    // 1. Find all line breaks to determine the highest common indentation level.
    const matches = s.replace(/\n+/g, '\n').match(/\n[\t ]*/g) || [];
    // 2. Remove the common indentation from all strings.
    if (matches.length) {
      const size = Math.min(
        ...matches.map((value) => (value as any).length - 1),
      );
      s = s.replace(new RegExp(`\n[\t ]{${size}}`, 'g'), '\n');
    }
    return s;
  };

  s.addAttribute('ast', {
    Exp: (a) => a.ast,

    ExpFunc_map_all: (a, _1, b, _2, c) => funcAst(b, a, c, true, a, c),
    ExpFunc_map_one: (a, _, b) => funcAst(null, a, b, true, a, b),
    ExpFunc_func_one: (a, _, b) => funcAst(null, a, b, false, a, b),
    ExpFunc_map: (_, a) => funcAst(null, null, a, true, _, a),
    ExpFunc_func: (_, a) => funcAst(null, null, a, false, _, a),
    ExpFunc_map_blank: (a) => funcAst(null, null, null, true, a, a),
    ExpFunc: (a) => a.ast,

    ExpSet_short_context: (a, _) =>
      assignAst(
        { type: 'combine', nodes: [a.ast, { type: 'context' }] },
        a.ast,
        a,
        _,
      ),
    ExpSet_short_value: (a, _) => assignAst(a.ast, a.ast, a, _),
    ExpSet_normal: (a, _, b) => assignAst(b.ast, a.ast, a, b),
    ExpSet_nil_value: (a, _) => assignAst({ type: 'nil' }, a.ast, a, _),
    ExpSet_nil_key: (_, a) => assignAst(a.ast, null, _, a),
    ExpSet_nil_both: (_) => assignAst({ type: 'nil' }, { type: 'nil' }, _, _),
    ExpSet: (a) => a.ast,

    ExpPush_push: (a, _, b) => ({
      type: 'push',
      nodes: [a.ast, b.ast],
      start: a.source.startIdx,
      end: b.source.endIdx,
    }),
    ExpPush: (a) => a.ast,

    ExpTrigger_trigger: (a, _, b) => ({
      type: 'trigger',
      nodes: [a.ast, b.ast],
      start: a.source.startIdx,
      end: b.source.endIdx,
    }),
    ExpTrigger: (a) => a.ast,

    ExpEval_eval: (a, _, b) => ({
      type: 'eval',
      nodes: [b.ast, a.ast],
      start: a.source.startIdx,
      end: b.source.endIdx,
    }),
    ExpEval_single: (a, b) => ({
      type: 'eval',
      nodes: [b.ast],
      start: a.source.startIdx,
      end: b.source.endIdx,
    }),
    ExpEval: (a) => a.ast,

    ExpNot_not: (a, b) => ({
      type: 'map',
      nodes: [b.ast],
      info: { func: a.sourceString },
      start: a.source.startIdx,
      end: b.source.endIdx,
    }),
    ExpNot: (a) => a.ast,

    ExpComp_comp: mapAst,
    ExpComp: (a) => a.ast,

    ExpSum_sum: mapAst,
    ExpSum_minus: (a, b) => ({
      type: 'map',
      nodes: [b.ast],
      info: { func: a.sourceString },
      start: a.source.startIdx,
      end: b.source.endIdx,
    }),
    ExpSum: (a) => a.ast,

    ExpProd_prod: mapAst,
    ExpProd: (a) => a.ast,

    ExpPow_pow: mapAst,
    ExpPow: (a) => a.ast,

    ExpSep_sep: (a, _, b) => ({
      type: 'combine',
      nodes: [
        ...(a.ast.type === 'combine' && a.ast.info.dot ? a.ast.nodes : [a.ast]),
        b.ast,
      ],
      info: { dot: true },
      start: a.source.startIdx,
      end: b.source.endIdx,
    }),
    ExpSep: (a) => a.ast,

    ExpComb_comb: (a, b) => {
      const nodes = [
        ...(a.ast.type === 'combine' ? a.ast.nodes : [a.ast]),
        b.ast,
      ];
      const [x, y] = nodes.slice(-2);
      const space =
        a.source.endIdx !== b.source.startIdx &&
        (x.type === 'value'
          ? !a.ast.info.value || /\S$/.test(a.ast.info.value)
          : true) &&
        (y.type === 'value'
          ? !b.ast.info.value || /^\S/.test(b.ast.info.value)
          : true);
      return {
        type: 'combine',
        nodes,
        info: {
          space: [...(a.ast.type === 'combine' ? a.ast.info.space : []), space],
        },
        start: a.source.startIdx,
        end: b.source.endIdx,
      };
    },
    ExpComb: (a) => a.ast,

    ExpSize_size: (a, b) => ({
      type: 'map',
      nodes: [b.ast],
      info: { func: a.sourceString },
      start: a.source.startIdx,
      end: b.source.endIdx,
    }),
    ExpSize: (a) => a.ast,

    Atom_space: (a) => ({
      type: 'value',
      info: { value: ' ' },
      start: a.source.startIdx,
      end: a.source.endIdx,
    }),
    Atom_context: (a) => ({
      type: 'context',
      start: a.source.startIdx,
      end: a.source.endIdx,
    }),
    Atom: (a) => a.ast,

    Block: (a, b, _, c, d) => blockAst(b, c, a, d),

    Line_string: (_1, a, _2) => {
      const items = [...a.ast];
      if (items.length === 0) {
        items.push({
          type: 'value',
          info: { value: '' },
          start: _1.source.endIdx,
          end: _1.source.endIdx,
        });
      }
      const indices = [
        [_1.source.startIdx, _1.source.endIdx],
        ...items.map((n) => [n.start, n.end]),
        [_2.source.startIdx, _2.source.endIdx],
      ];
      items.forEach((n, i) => {
        if (n.type === 'value') {
          const s = `${_1.source.sourceString.slice(indices[i][1], n.start)}${
            n.info.value
          }${_2.source.sourceString.slice(n.end, indices[i + 2][0])}`;
          n.info.value = parseString(s)
            .replace(/(\s)'/g, (_, m) => `${m}‘`)
            .replace(/'/g, '’')
            .replace(/(\s)"/g, (_, m) => `${m}“`)
            .replace(/"/g, '”');
          n.info.multi = true;
          n.start = indices[i][1];
          n.end = indices[i + 2][0];
        }
      });
      items[0].info = { ...(items[0].info || {}), first: true };
      items[items.length - 1].info = {
        ...(items[items.length - 1].info || {}),
        last: true,
      };
      return items;
    },

    Line_exp: (a) => [a.ast],
    Line_nil: (a) => [
      {
        type: 'nil',
        start: a.source.startIdx,
        end: a.source.endIdx,
      },
    ],

    Multi_string: (a) => ({
      type: 'value',
      info: { value: a.sourceString },
      start: a.source.startIdx,
      end: a.source.endIdx,
    }),
    Multi_block: (a, b, _, c, d) => blockAst(b, c, a, d),

    value_char: (_, a) => ({
      type: 'value',
      info: { value: /\s/.test(a.sourceString) ? '\n' : a.sourceString },
      start: _.source.startIdx,
      end: a.source.endIdx,
    }),
    value_number: (a, _, b) => ({
      type: 'value',
      info: { value: `${a.sourceString}.${b.sourceString}` },
      start: a.source.startIdx,
      end: b.source.endIdx,
    }),
    value_value: (a) => ({
      type: 'value',
      info: { value: a.sourceString },
      start: a.source.startIdx,
      end: a.source.endIdx,
    }),
    value_string: (_1, a, _2) => ({
      type: 'value',
      info: {
        value: dedent(a.sourceString.replace(/\\([\s\S])/g, (_, m) => m)),
      },
      start: _1.source.startIdx,
      end: _2.source.endIdx,
    }),
    value_string2: (_1, a, _2) => ({
      type: 'value',
      info: {
        value: parseString(a.sourceString)
          .replace(/(\s)'/g, (_, m) => `${m}‘`)
          .replace(/'/g, '’')
          .replace(/(\s)"/g, (_, m) => `${m}“`)
          .replace(/"/g, '”'),
      },
      start: _1.source.startIdx,
      end: _2.source.endIdx,
    }),
    value_comment: (_1, a, _2) => ({
      type: 'comment',
      info: {
        value: parseString(a.sourceString.replace(/\\/g, '\\\\')),
      },
      start: _1.source.startIdx,
      end: _2.source.endIdx,
    }),

    char: (a) => a.sourceString,
    char2: (a) => a.sourceString,
    escape: (_, a) => a.sourceString,
  });
};

export default (script: string): AST => {
  if (!s) loadSemantics();
  if (!script.trim()) {
    return { type: 'nil', start: 0, end: 0, __AST: true };
  }
  const m = g.match(script);
  if (m.failed()) throw new Error('Parser error');
  return { ...s(m).ast, __AST: true };
};
