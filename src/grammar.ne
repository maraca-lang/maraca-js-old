@{%
const lexer = require('./lexer').default;
%}
@lexer lexer

body ->
    (_ statement _ ";"):* _ statement _ ";":?
  | _

statement ->
    (detable | label) _ "=" _ exp
  | %id _ "="
  | exp
  | null

detable ->
    "[" (_ destatement _ ";"):* _ destatement _ ";":? _ "]"

destatement ->
    label _ "=" _ %id
  | %id _ "="
  | %id

label ->
    bracketed
  | %txt

bracketed -> "(" _ exp _ ")"

exp ->
    expid

expid ->
    label _ "~" _ exppair
  | exppair

exppair ->
    exppair _ ":" _ expor
  | expor

expor ->
    expor _ "or" _ expand
  | expand

expand ->
    expand _ "and" _ expcomp
  | expcomp

expcomp ->
	  expcomp _ "<" _ expsum
	| expcomp _ ">" _ expsum
	| expcomp _ "<=" _ expsum
	| expcomp _ ">=" _ expsum
	| expcomp _ "!=" _ expsum
	| expcomp _ "==" _ expsum
	| expsum

expsum ->
	  expsum _ "+" _ expprod
	| expsum _ "-" _ expprod
	| expprod

expprod ->
	  expprod _ "*" _ expuni
	| expprod _ "/" _ expuni
	| expprod _ "%" _ expuni
	| expuni

expuni ->
	  (value | "!") _ exppow
	| exppow

exppow ->
    exppow _ "^" _ value
  | value

expis ->
    expis _ "?"
  | value

function ->
    (detable | %id) _ "=>" _ exp

table ->
    "[" _ body _ "]"

set ->
    "{" (_ exp _ ";"):* _ exp _ ";":? _ "}"
  | "{" _ "}"

value ->
  %id | table | set | %str | %num | "*" | "+" | "-" | "nil" | bracketed

_ ->
  %_:? {% () => null %}
