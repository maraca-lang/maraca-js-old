import * as moo from 'moo';

const toNull = v => (v === 0 || v === '' || v === 'nil' ? null : v);

export default moo.compile({
  value: {
    match: /[a-zA-Z\d_]+|(?:\d+\.\d+)/,
    value: s => toNull(/^[\d\.]+$/.test(s) ? parseFloat(s) : s),
  },
  string: {
    match: /"(?:\\["\\]|[^\n"\\])*"/,
    value: s => toNull(s.slice(1, -1)),
  },
  multi: ['=>', '<=', '>=', '!=', '==', '...'],
  brackets: ['[', ']', '(', ')', '<', '>'],
  operators: ['!', '%', '+', '-', '*', '/', '^', ':', '='],
  misc: [';', '@'],
  _: { match: /\s+/, lineBreaks: true },
});
