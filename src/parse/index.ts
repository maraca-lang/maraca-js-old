import { Grammar, Parser } from 'nearley';

import * as grammar from '../../lib/grammar';
import lexer from './lexer';

export default script => {
  lexer.reset(script);
  const parser = new Parser(Grammar.fromCompiled(grammar));
  parser.feed(script);
  // if (parser.results.length > 1) console.log('AMBIGUOUS!');
  // console.log(JSON.stringify(parser.results, null, 2));
  if (parser.results.length === 0) throw new Error('Parser error');
  return parser.results[0];
};
