import { Grammar, Parser } from 'nearley';
import * as grammar from '../lib/grammar';

const parser = new Parser(Grammar.fromCompiled(grammar));

parser.feed(`[a; b; c]`);

console.log(JSON.stringify(parser.results, null, 2));
