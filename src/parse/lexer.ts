import * as moo from 'moo';

import dedent from './dedent';

const toData = s =>
  s ? { type: 'value', info: { value: s } } : { type: 'nil' };

const parseString = (s, withDivider) => {
  const clean = dedent(
    withDivider ? s.replace(/>/g, '￿1').replace(/\\￿1/g, '>') : s,
  )
    .replace(/\n/g, '￿2')
    .replace(/\\(￿2| )/g, '\n')
    .replace(/\\(.)/g, (_, m) => m)
    .replace(/(\s|￿2)*(\n|￿2)(\s|￿2)*(\n|￿2)/g, '\n\n')
    .replace(/￿2/g, ' ')
    .replace(/￿1/g, '￿');
  return clean
    .split('\n')
    .map(s => {
      const parts = s.split(/^(\s*)/g);
      const [, indent, rest] =
        parts.length < 3 ? ['', '', ...parts, ''] : parts;
      return `${indent}${rest.replace(/\s+/g, ' ')}`;
    })
    .join('\n');
};

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
      match: /\\(?:\S|\n)/,
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
        info: { value: parseString(s.slice(1, -1), false) },
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
      value: s => toData(parseString(s, true)),
      lineBreaks: true,
    },
  },
});
