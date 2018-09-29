import * as moo from 'moo';

const toNull = v => (v === '' || v === 'nil' ? null : v);

export default moo.compile({
  value: {
    match: /[a-zA-Z0-9_\.]+/,
    value: s => toNull(s),
  },
  string: {
    match: /"(?:\\["\\]|[^\n"\\])*"/,
    value: s => toNull(s.slice(1, -1)),
  },
  multi: ['[*', '=>', '<=', '>=', '!=', '::', '..'],
  brackets: ['[', ']', '(', ')'],
  comparison: ['<', '>', '='],
  arithmetic: ['+', '-', '*', '/', '%', '^'],
  misc: [',', '?', ':', '~', '&', '@'],
  _: { match: /\s+/, lineBreaks: true },
});
