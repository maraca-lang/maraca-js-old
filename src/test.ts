import { Grammar, Parser } from 'nearley';
import * as grammar from '../lib/grammar';
import compile from './engine';

const parse = file => {
  const parser = new Parser(Grammar.fromCompiled(grammar));
  parser.feed(
    file
      .replace(/\band\b/g, '$$&&')
      .replace(/\bor\b/g, '$$||')
      .replace(/\bnot\b/g, '$$!!')
      .replace(/[\w\.][\w\.\s]+[\w\.]/g, m => `"${m.replace(/\s+/g, ' ')}"`)
      .replace(/\$\$\&\&/g, 'and')
      .replace(/\$\$\|\|/g, 'or')
      .replace(/\$\$\!\!/g, 'not'),
  );
  if (parser.results.length > 1) console.log('AMBIGUOUS!');
  console.log(JSON.stringify(parser.results, null, 2));
  return parser.results[0];
};

const config = parse(`[x:= 1, a*]`);
const result = compile(config);

console.log(JSON.stringify(result().data.value.values, null, 2));
result(data => console.log(JSON.stringify(data.data.value.values, null, 2)));
