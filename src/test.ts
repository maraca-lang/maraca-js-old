import { Grammar, Parser } from 'nearley';
import * as grammar from '../lib/grammar';
import compile from './index';

const parser = new Parser(Grammar.fromCompiled(grammar));

parser.feed(`x => @x + 1`);

if (parser.results.length > 1) console.log('AMBIGUOUS!');
console.log(JSON.stringify(parser.results));

const x = compile(parser.results[0]);
console.log(JSON.stringify(x, null, 2));
