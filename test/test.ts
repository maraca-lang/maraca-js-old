import { Grammar, Parser } from 'nearley';
import * as grammar from '../lib/grammar';

const parser = new Parser(Grammar.fromCompiled(grammar));

parser.feed(`x = a => a@ -1`);

if (parser.results.length > 1) console.log('AMBIGUOUS!');

console.log(JSON.stringify(parser.results, null, 2));
