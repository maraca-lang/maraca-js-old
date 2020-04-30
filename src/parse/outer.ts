import * as ohm from 'ohm-js';

type PartNode = {
  type: 'part';
  info: { value: string };
  start: number;
  end: number;
};
type BlockNode = {
  type: 'block';
  nodes: (TextNode | Parts)[];
  info: { bracket: '[' | '(' | '{' | '<' };
  start: number;
  end: number;
};
type TextNode = {
  type: 'text';
  nodes: Parts;
  start: number;
  end: number;
};
type Parts = (PartNode | BlockNode)[];

const grammar = `Maraca {

  base
    = chunk*

  item
    = space* "\\"" (textblock | textchar | escape)* "\\"" space* -- text
    | base -- base

  chunk
    = block
    | "\\"" (textchar | escape)* "\\"" -- text
    | "'" (stringchar | escape)* "'" -- string
    | escape
    | ~("[" | "]" | "(" | ")" | "{" | "}" | "￿" | "," | "\\\\" | "\\"" | "'") any -- other
  
  block
    = "[" item ("," item)* "]"
    | "(" item ("," item)* ")"
    | "{" item ("," item)* "}"
  
  textblock
    = "<" item ("," item)* "￿>"

  textchar
    = ~("\\"" | "<" | "\\\\") any

  stringchar
    = ~("'" | "\\\\") any

  escape
    = "\\\\" any

}`;

export default () => {
  const g = ohm.grammar(grammar);
  const s = g.createSemantics();

  const joinStrings = (nodes) => {
    const result = [] as any[];
    for (const x of nodes) {
      if (
        x.type === 'part' &&
        result.length > 0 &&
        result[result.length - 1].type === 'part'
      ) {
        result[result.length - 1].info.value += x.info.value;
        result[result.length - 1].end = x.end;
      } else {
        result.push(x);
      }
    }
    return result;
  };

  s.addAttribute('ast', {
    base: (a) => {
      const result = joinStrings(a.ast);
      if (result.length > 0) {
        if (result[0].type === 'part') {
          result[0].info.value = result[0].info.value.trimLeft();
        }
        if (result[result.length - 1].type === 'part') {
          result[result.length - 1].info.value = result[
            result.length - 1
          ].info.value.trimRight();
        }
      }
      return result;
    },

    item_text: (_1, _2, a, _3, _4) => ({
      type: 'text',
      nodes: joinStrings(a.ast),
      start: _2.source.startIdx,
      end: _3.source.endIdx,
    }),
    item_base: (a) => a.ast,

    chunk: (a) => a.ast,
    chunk_text: (_1, a, _2) => ({
      type: 'part',
      info: { value: joinStrings(["'", ...a.ast, "'"])[0] },
      start: _1.source.startIdx,
      end: _2.source.endIdx,
    }),
    chunk_string: (_1, a, _2) => ({
      type: 'part',
      info: { value: `'${a.sourceString}'` },
      start: _1.source.startIdx,
      end: _2.source.endIdx,
    }),
    chunk_other: (a) => ({
      type: 'part',
      info: { value: a.sourceString },
      start: a.source.startIdx,
      end: a.source.endIdx,
    }),

    block: (a, b, _1, c, _2) => ({
      type: 'block',
      nodes: [b.ast, ...c.ast],
      info: { bracket: a.sourceString },
      start: a.source.startIdx,
      end: _2.source.endIdx,
    }),

    textblock: (a, b, _1, c, _2) => ({
      type: 'block',
      nodes: [b.ast, ...c.ast],
      info: { bracket: a.sourceString },
      start: a.source.startIdx,
      end: _2.source.endIdx,
    }),

    textchar: (a) => ({
      type: 'part',
      info: { value: a.sourceString },
      start: a.source.startIdx,
      end: a.source.endIdx,
    }),

    stringchar: (a) => ({
      type: 'part',
      info: { value: a.sourceString },
      start: a.source.startIdx,
      end: a.source.endIdx,
    }),

    escape: (a, b) => ({
      type: 'part',
      info: { value: `${a.sourceString}${b.sourceString}` },
      start: a.source.startIdx,
      end: b.source.endIdx,
    }),
  });

  return (script) => {
    const m = g.match(script.replace(/\/>/g, '￿>'));
    if (m.failed()) throw new Error('Parser error');
    return s(m).ast as Parts;
  };
};
