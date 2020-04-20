import * as ohm from 'ohm-js';

const dedent = (str) => {
  let s = str;
  // 1. Find all line breaks to determine the highest common indentation level.
  const matches = s.replace(/\n+/g, '\n').match(/\n[\t ]*/g) || [];
  // 2. Remove the common indentation from all strings.
  if (matches.length) {
    const size = Math.min(...matches.map((value) => (value as any).length - 1));
    s = s.replace(new RegExp(`\n[\t ]{${size}}`, 'g'), '\n');
  }
  return s;
};

export const parseString = (s) =>
  dedent(s)
    .replace(/\n/g, '￿')
    .replace(/\\(￿| )/g, '\n')
    .replace(/\\(.)/g, (_, m) => m)
    .replace(/(\s|￿)*(\n|￿)(\s|￿)*(\n|￿)(\s|￿)*/g, '\n\n')
    .replace(/(￿| |\t)+/g, ' ');

const grammar = `Maraca {

  Exp
    = ExpFunc

  ExpFunc
    = ExpSet "=>" ExpSet "=>" ExpSet -- map_all
    | ExpSet "=>>" ExpSet -- map_one
    | ExpSet "=>" ExpSet -- func_one
    | "=>>" ExpSet -- map
    | "=>" ExpSet -- func
    | "=>>" -- map_blank
    | ExpSet

  ExpSet
    = ExpSet ":=?" -- short_context
    | ExpSet ":=" -- short_value
    | ExpPush ":" ExpSet -- normal
    | ExpSet ":" -- nil_value
    | ":" ExpSet -- nil_key
    | ":" -- nil_both
    | ExpPush

  ExpPush
    = ExpPush "->" ExpTrigger -- push
    | ExpTrigger

  ExpTrigger
    = ExpTrigger "|" ExpEval -- trigger
    | ExpEval

  ExpEval
    = ExpEval ">>" ExpNot -- eval
    | ">>" ExpNot -- single
    | ExpNot

  ExpNot
    = "!" ExpComp -- not
    | ExpComp

  ExpComp
    = ExpComp ("<=" | ">=" | "<" | ">" | "!" | "=") ExpSum -- comp
    | ExpSum

  ExpSum
    = ExpSum ("+" | "-") ExpProd -- sum
    | "-" ExpProd -- minus
    | ExpProd

  ExpProd
    = ExpProd ("*" | "/" | "%") ExpPow -- prod
    | ExpPow

  ExpPow
    = ExpPow "^" ExpSep -- pow
    | ExpSep
  
  ExpSep
    = ExpSep "." ExpSize -- sep
    | ExpSize
  
  ExpSize
    = "#" ExpComb -- size
    | ExpComb

  ExpComb
    = ExpComb Atom -- comb
    | Atom

  Atom
    = value
    | "_" -- space
    | "?" -- context
    | "￿" digit+ "￿" -- placeholder

  value
    = "\\\\" any -- char
    | digit+ "." digit+ -- number
    | alnum+ -- value
    | "'" (char | escape)* "'" -- string
    | "\`" (~"\`" any)* "\`" -- comment

  char
    = ~("'" | "\\\\") any

  escape
    = "\\\\" any

}`;

export default () => {
  const g = ohm.grammar(grammar);
  const s = g.createSemantics();

  let parts;
  let offsets;

  const getIndex = (index) => {
    let i = offsets.findIndex(([a]) => a > index);
    if (i === -1) i = offsets.length;
    return index + offsets[i - 1][1];
  };

  const funcAst = (key, value, body, map, first, last) => ({
    type: 'func',
    nodes: [key && key.ast, value && value.ast],
    info: { body: body?.ast || { type: 'nil' }, map },
    start: getIndex(first.source.startIdx),
    end: getIndex(last.source.endIdx),
  });
  const assignAst = (value, key, first, last) => ({
    type: 'assign',
    nodes: [value, key],
    start: getIndex(first.source.startIdx),
    end: getIndex(last.source.endIdx),
  });
  const mapAst = (arg1, func, arg2) => ({
    type: 'map',
    nodes: [arg1.ast, arg2.ast],
    info: { func: func.sourceString },
    start: getIndex(arg1.source.startIdx),
    end: getIndex(arg2.source.endIdx),
  });

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
      start: getIndex(a.source.startIdx),
      end: getIndex(b.source.endIdx),
    }),
    ExpPush: (a) => a.ast,

    ExpTrigger_trigger: (a, _, b) => ({
      type: 'trigger',
      nodes: [a.ast, b.ast],
      start: getIndex(a.source.startIdx),
      end: getIndex(b.source.endIdx),
    }),
    ExpTrigger: (a) => a.ast,

    ExpEval_eval: (a, _, b) => ({
      type: 'eval',
      nodes: [b.ast, a.ast],
      start: getIndex(a.source.startIdx),
      end: getIndex(b.source.endIdx),
    }),
    ExpEval_single: (a, b) => ({
      type: 'eval',
      nodes: [b.ast],
      start: getIndex(a.source.startIdx),
      end: getIndex(b.source.endIdx),
    }),
    ExpEval: (a) => a.ast,

    ExpNot_not: (a, b) => ({
      type: 'map',
      nodes: [b.ast],
      info: { func: a.sourceString },
      start: getIndex(a.source.startIdx),
      end: getIndex(b.source.endIdx),
    }),
    ExpNot: (a) => a.ast,

    ExpComp_comp: mapAst,
    ExpComp: (a) => a.ast,

    ExpSum_sum: mapAst,
    ExpSum_minus: (a, b) => ({
      type: 'map',
      nodes: [b.ast],
      info: { func: a.sourceString },
      start: getIndex(a.source.startIdx),
      end: getIndex(b.source.endIdx),
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
      start: getIndex(a.source.startIdx),
      end: getIndex(b.source.endIdx),
    }),
    ExpSep: (a) => a.ast,

    ExpSize_size: (a, b) => ({
      type: 'map',
      nodes: [b.ast],
      info: { func: a.sourceString },
      start: getIndex(a.source.startIdx),
      end: getIndex(b.source.endIdx),
    }),
    ExpSize: (a) => a.ast,

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
        start: getIndex(a.source.startIdx),
        end: getIndex(b.source.endIdx),
      };
    },
    ExpComb: (a) => a.ast,

    Atom_space: (a) => ({
      type: 'value',
      info: { value: ' ' },
      start: getIndex(a.source.startIdx),
      end: getIndex(a.source.endIdx),
    }),
    Atom_context: (a) => ({
      type: 'context',
      start: getIndex(a.source.startIdx),
      end: getIndex(a.source.endIdx),
    }),
    Atom_placeholder: (_1, a, _2) => parts[parseInt(a.sourceString, 10)],
    Atom: (a) => a.ast,

    value_char: (_, a) => ({
      type: 'value',
      info: { value: /\s/.test(a.sourceString) ? '\n' : a.sourceString },
      start: getIndex(_.source.startIdx),
      end: getIndex(a.source.endIdx),
    }),
    value_number: (a, _, b) => ({
      type: 'value',
      info: { value: `${a.sourceString}.${b.sourceString}` },
      start: getIndex(a.source.startIdx),
      end: getIndex(b.source.endIdx),
    }),
    value_value: (a) => ({
      type: 'value',
      info: { value: a.sourceString },
      start: getIndex(a.source.startIdx),
      end: getIndex(a.source.endIdx),
    }),
    value_string: (_1, a, _2) => ({
      type: 'value',
      info: {
        value: dedent(a.sourceString.replace(/\\([\s\S])/g, (_, m) => m)),
      },
      start: getIndex(_1.source.startIdx),
      end: getIndex(_2.source.endIdx),
    }),
    value_comment: (_1, a, _2) => ({
      type: 'comment',
      info: {
        value: parseString(a.sourceString.replace(/\\/g, '\\\\')),
      },
      start: getIndex(_1.source.startIdx),
      end: getIndex(_2.source.endIdx),
    }),

    char: (a) => a.sourceString,
    escape: (_, a) => a.sourceString,
  });

  return (script, scriptParts, scriptOffsets) => {
    if (!script.trim()) {
      return { type: 'nil', start: getIndex(0), end: getIndex(script.length) };
    }
    parts = scriptParts;
    offsets = scriptOffsets;
    const m = g.match(script);
    if (m.failed()) throw new Error('Parser error');
    return s(m).ast;
  };
};
