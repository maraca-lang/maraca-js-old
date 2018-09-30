import * as moo from 'moo';

const toData = s =>
  s && s !== 'nil' ? { type: 'string', value: s } : { type: 'nil' };

export default moo.compile({
  value: {
    match: /[\w\.]+/,
    keywords: {
      keyword: ['and', 'or', 'not'],
    },
    value: s => toData(s),
  },
  string: {
    match: /"(?:\\["\\]|[^\n"\\])*"/,
    value: s => toData(s.slice(1, -1)),
  },
  multi: ['[*', '*]', '=>', '<=', '>=', '!=', ':=', '..', '>>'],
  brackets: ['[', ']', '(', ')'],
  comparison: ['<', '>', '='],
  arithmetic: ['+', '-', '*', '/', '%', '^'],
  misc: [',', '?', ':', '~', '&', '@'],
  _: { match: /\s+/, lineBreaks: true },
});
