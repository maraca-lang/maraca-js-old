import * as moo from 'moo';

import dedent from './dedent';

const toData = s =>
  s ? { type: 'value', info: { value: s } } : { type: 'nil' };

const parseString = (s, withDivider) =>
  dedent(withDivider ? s.replace(/>/g, '￿1').replace(/\\￿1/g, '>') : s)
    .replace(/\n/g, '￿2')
    .replace(/\\(￿2| )/g, '\n')
    .replace(/\\(.)/g, (_, m) => m)
    .replace(/(\s|￿2)*(\n|￿2)(\s|￿2)*(\n|￿2)(\s|￿2)*/g, '\n\n')
    .replace(/(￿2| |\t)+/g, ' ')
    .replace(/￿1/g, '￿');

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
      match: /\\(?:\S|\n| )/,
      value: s => toData(s[1] === ' ' ? '\n' : s[1]),
    },
    value: {
      match: /(?:\d+\.\d+)|(?:[a-zA-Z0-9]+)/,
      value: s => toData(s),
    },
    strstart: {
      match: "'",
      push: 'str',
    },
    string: {
      match: /"(?:\\[\s\S]|[^"\\])*"/,
      value: s =>
        toData(dedent(s.slice(1, -1).replace(/\\([\s\S])/g, (_, m) => m))),
    },
    comment: {
      match: /`[^`]*`/,
      value: s => ({
        type: 'comment',
        info: {
          value: parseString(s.slice(1, -1).replace(/\\/g, '\\\\'), false),
        },
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
      match: "'",
      pop: true,
    },
    content: {
      match: /(?:(?:\\.)|[^<'])+/,
      value: s =>
        toData(
          parseString(s, true)
            .replace(/[‘’]/g, "'")
            .replace(/[“”]/g, '"')
            .replace(/(\s)'/g, (_, m) => `${m}‘`)
            .replace(/'/g, '’')
            .replace(/(\s)"/g, (_, m) => `${m}“`)
            .replace(/"/g, '”'),
        ),
      lineBreaks: true,
    },
  },
});
