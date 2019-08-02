import * as moo from 'moo';

import dedent from './dedent';

const toData = s =>
  s ? { type: 'value', info: { value: s } } : { type: 'nil' };

export default moo.compile({
  multi: ['=>>', '=>', '->', '<=', '>=', '==', ':=?', ':=', '@@', '@@@'],
  brackets: ['[', ']', '(', ')', '{', '}'],
  comparison: ['<', '>', '='],
  arithmetic: ['+', '-', '*', '/', '%', '^'],
  misc: [',', '?', ':', '~', '!', '#', '@', '.', '|', '$', '_'],
  char: {
    match: /'(?:\S|\n)/,
    value: s => toData(s[1]),
  },
  value: {
    match: /(?:\d+\.\d+)|(?:[a-zA-Z0-9]+)/,
    value: s => toData(s),
  },
  string: {
    match: /"(?:""|[^"])*"/,
    value: s => toData(dedent(s.slice(1, -1).replace(/""/g, '"'))),
  },
  comment: {
    match: /`[^`]*`/,
    value: s => ({ type: 'comment', info: { value: dedent(s.slice(1, -1)) } }),
  },
  _: { match: /\s+/, lineBreaks: true },
});
