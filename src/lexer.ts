import * as moo from 'moo';

const toData = s =>
  s && s !== 'nil' ? { type: 'string', value: s } : { type: 'nil' };

export default moo.compile({
  copy: /:=\s*\?/,
  fill: /\*\*\s*:=/,
  multi: ['=>', '<=', '>=', '!=', ':='],
  brackets: ['[', ']', '(', ')'],
  comparison: ['<', '>', '='],
  arithmetic: ['+', '-', '*', '/', '%', '^'],
  misc: [',', '?', ':', '~', '&', '#', '@', '|'],
  value: {
    match: /[\w\.]+/,
    keywords: {
      keyword: ['nil', 'and', 'or', 'not'],
    },
    value: s => toData(s),
  },
  string: {
    match: /"(?:\\["\\]|[^\n"\\])*"/,
    value: s => toData(s.slice(1, -1)),
  },
  _: { match: /\s+/, lineBreaks: true },
});
