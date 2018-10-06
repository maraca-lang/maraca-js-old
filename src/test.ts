import { Grammar, Parser } from 'nearley';
import * as grammar from '../lib/grammar';
import run from './engine';

import lexer from './lexer';

const parse = script => {
  lexer.reset(script);
  let result = '';
  let s = '';
  let space = false;
  for (const token of lexer) {
    if (token.type === '_') {
      if (!s) result += ' ';
    } else if (token.type === 'value' || token.type === 'string') {
      s += `${s ? ' ' : ''}${
        token.value.type === 'nil' ? '*' : token.value.value
      }`;
    } else {
      if (s) {
        result += `"${s
          .replace(/\*/g, '')
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')}"`;
        if (space) result += ' ';
        s = '';
      }
      result += token.text;
    }
    space = token.type === '_';
  }
  if (s) result += `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  console.log(result);
  const parser = new Parser(Grammar.fromCompiled(grammar));
  parser.feed(result);
  if (parser.results.length > 1) console.log('AMBIGUOUS!');
  console.log(JSON.stringify(parser.results, null, 2));
  return parser.results[0];
};

const log = x => console.log(JSON.stringify(x, null, 2));
const config = parse(`[x:=@now, y:=x?]`);
const result = run(config, log);
log(result);
