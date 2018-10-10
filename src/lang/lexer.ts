import * as moo from 'moo';

const toData = s =>
  s && s !== '0' ? { type: 'string', value: s } : { type: 'nil' };

export default moo.compile({
  multi: ['=>>', '=>', '<=', '>=', '!=', ':=?', ':=', '::', '..'],
  brackets: ['[', ']', '(', ')', '{', '}'],
  comparison: ['<', '>', '='],
  arithmetic: ['+', '-', '*', '/', '%', '^'],
  misc: [',', '?', ':', '~', '&', '!', '#', '@', '_', '|'],
  value: {
    match: /[a-zA-Z0-9\.]+/,
    value: s => toData(s),
  },
  string: {
    match: /"(?:\\["\\]|[^\n"\\])*"/,
    value: s => toData(s.slice(1, -1)),
  },
  _: { match: /\s+/, lineBreaks: true },
});
