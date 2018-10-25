import * as moo from 'moo';
import * as dedent from 'dedent';

const toData = s => (s ? { type: 'string', value: s } : { type: 'nil' });

export default moo.compile({
  multi: [
    '=>>',
    '=>',
    '<=',
    '>=',
    '==',
    ':=?',
    ':=',
    '::',
    '...',
    '..',
    '##',
    '@@',
  ],
  brackets: ['[', ']', '(', ')', '{', '}'],
  comparison: ['<', '>', '='],
  arithmetic: ['+', '-', '*', '/', '%', '^'],
  misc: [',', '?', ':', '~', '&', '!', '#', '@', '|'],
  value: {
    match: /(?:[a-zA-Z0-9]+)|(?:\d*\.?\d+)/,
    value: s => toData(s),
  },
  string: {
    match: /"(?:\\["\\]|[^"\\])*"/,
    value: s =>
      toData(
        dedent(
          s
            .slice(1, -1)
            .replace(/\\\\/g, '\\')
            .replace(/\\"/g, '"'),
        ),
      ),
  },
  _: { match: /\s+/, lineBreaks: true },
});
