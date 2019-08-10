import * as moo from 'moo';

import dedent from './dedent';

const toData = s =>
  s ? { type: 'value', info: { value: s } } : { type: 'nil' };

export default moo.states({
  main: {
    mainend: {
      match: '/>',
      pop: true,
    },
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
    strstart: {
      match: '"',
      push: 'str',
    },
    comment: {
      match: /`[^`]*`/,
      value: s => ({
        type: 'comment',
        info: { value: dedent(s.slice(1, -1)) },
      }),
    },
    _: { match: /\s+/, lineBreaks: true },
  },
  str: {
    mainstart: {
      match: '<',
      push: 'main',
    },
    strend: {
      match: '"',
      pop: true,
    },
    content: {
      match: /(?:(?:\\.)|[^<"])+/,
      value: s =>
        toData(
          dedent(
            s
              .replace(/>/g, '￿')
              .replace(/\\(.)/g, (_, m) => (m === '￿' ? '>' : m)),
          ),
        ),
      lineBreaks: true,
    },
  },
});
