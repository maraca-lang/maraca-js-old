import * as ohm from 'ohm-js';

export const dedent = (str) => {
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

const grammar = `Maraca {

  Main
    = Func
    | Set
    | Push
    | Exp

  Func
    = Exp? "=>" Exp "=>" (Exp? ":")? Exp? -- map_keys
    | Exp? "=>>" (Exp? ":")? Exp? -- map
    | Exp? "=>" Exp? -- func

  Set
    = Exp ":=?" -- context
    | Exp ":=" -- value
    | Exp? ":~" Exp? -- push
    | Exp? ":" Exp? -- set

  Push
    = Exp "->" Exp -- push
  
  Exp
    = Trigger

  Trigger
    = Eval "|" Eval -- trigger
    | Eval

  Eval
    = Not? ">>" Not -- eval
    | Not

  Not
    = "!" Comp -- not
    | Comp

  Comp
    = Comp ("<=" | ">=" | "<" | ">" | "!" | "=") Sum -- comp
    | Sum

  Sum
    = Sum ("+" | "-") Prod -- sum
    | "-" Prod -- minus
    | Prod

  Prod
    = Prod ("*" | "/" | "%") Pow -- prod
    | Pow

  Pow
    = Pow "^" Sep -- pow
    | Sep
  
  Sep
    = Sep "." Size -- sep
    | Size
  
  Size
    = "#" Comb -- size
    | Comb

  Comb
    = Comb Atom -- comb
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

  const funcAst = (key, value, bodyKey, bodyValue, map, first, last) => ({
    type: 'func',
    nodes: [key, value],
    info: {
      key: bodyKey ? bodyKey[0] : true,
      value: bodyValue || { type: 'nil' },
      map,
    },
    start: getIndex(first.source.startIdx),
    end: getIndex(last.source.endIdx),
  });
  const assignAst = (value, key, first, last, pushable = false) => ({
    type: 'assign',
    nodes: [value || { type: 'nil' }, key],
    info: { pushable },
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
    Main: (a) => a.ast,

    Func_map_keys: (a, _1, b, _2, c, _3, d) =>
      funcAst(b.ast, a.ast[0], c.ast[0], d.ast[0], true, a, c),
    Func_map: (a, _1, b, _2, c) =>
      funcAst(null, a.ast[0], b.ast[0], c.ast[0], true, a, b),
    Func_func: (a, _, b) =>
      funcAst(null, a.ast[0], null, b.ast[0], false, a, b),

    Set_context: (a, _) =>
      assignAst(
        { type: 'combine', nodes: [a.ast, { type: 'context' }] },
        a.ast,
        a,
        _,
      ),
    Set_value: (a, _) => assignAst(a.ast, a.ast, a, _),
    Set_push: (a, _, b) => assignAst(b.ast[0], a.ast[0], a, b, true),
    Set_set: (a, _, b) => assignAst(b.ast[0], a.ast[0], a, b),

    Push_push: (a, _, b) => ({
      type: 'push',
      nodes: [a.ast, b.ast],
      start: getIndex(a.source.startIdx),
      end: getIndex(b.source.endIdx),
    }),

    Exp: (a) => a.ast,

    Trigger_trigger: (a, _, b) => ({
      type: 'trigger',
      nodes: [a.ast, b.ast],
      start: getIndex(a.source.startIdx),
      end: getIndex(b.source.endIdx),
    }),
    Trigger: (a) => a.ast,

    Eval_eval: (a, _, b) => ({
      type: 'eval',
      nodes: [b.ast, a.ast[0]].filter((x) => x),
      start: getIndex(a.source.startIdx),
      end: getIndex(b.source.endIdx),
    }),
    Eval: (a) => a.ast,

    Not_not: (a, b) => ({
      type: 'map',
      nodes: [b.ast],
      info: { func: a.sourceString },
      start: getIndex(a.source.startIdx),
      end: getIndex(b.source.endIdx),
    }),
    Not: (a) => a.ast,

    Comp_comp: mapAst,
    Comp: (a) => a.ast,

    Sum_sum: mapAst,
    Sum_minus: (a, b) => ({
      type: 'map',
      nodes: [b.ast],
      info: { func: a.sourceString },
      start: getIndex(a.source.startIdx),
      end: getIndex(b.source.endIdx),
    }),
    Sum: (a) => a.ast,

    Prod_prod: mapAst,
    Prod: (a) => a.ast,

    Pow_pow: mapAst,
    Pow: (a) => a.ast,

    Sep_sep: (a, _, b) => ({
      type: 'combine',
      nodes: [
        ...(a.ast.type === 'combine' && a.ast.info.dot ? a.ast.nodes : [a.ast]),
        b.ast,
      ],
      info: { dot: true },
      start: getIndex(a.source.startIdx),
      end: getIndex(b.source.endIdx),
    }),
    Sep: (a) => a.ast,

    Size_size: (a, b) => ({
      type: 'map',
      nodes: [b.ast],
      info: { func: a.sourceString },
      start: getIndex(a.source.startIdx),
      end: getIndex(b.source.endIdx),
    }),
    Size: (a) => a.ast,

    Comb_comb: (a, b) => {
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
    Comb: (a) => a.ast,

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
    if (m.failed()) throw new Error(m.message);
    return s(m).ast;
  };
};
