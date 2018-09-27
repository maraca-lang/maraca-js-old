@{%
const lexer = require('./lexer').default;
const func = x => [[{ type: "function", value: x[2].value }, x[0]], x[4]];
%}
@lexer lexer

main ->
    _ body _ {% x => x[1] %}
  | _ {% () => [] %}

table ->
    "[" _ body _ "]" {% x => ({ type: "table", value: x[2] }) %}
  | "[" _ "]" {% () => ({ type: "value", value: null }) %}

body ->
    body _ ";" _ exp _ ";":? {% x => [...x[0], x[4]] %}
  | exp _ ";":? {% x => [x[0]] %}

group -> "(" _ exp _ ")" {% x => x[2] %}

exp ->
    expeq {% id %}

expeq ->
    expeq _ "=" _ expfunc {% func %}
  | expfunc {% id %}

expfunc ->
    expfunc _ "=>" _ expid {% func %}
  | expid {% id %}

expid ->
    expid _ ":" _ expor {% func %}
  | expor {% id %}

expor ->
    expor _ "or" _ expand {% func %}
  | expand {% id %}

expand ->
    expand _ "and" _ expcomp {% func %}
  | expcomp {% id %}

expcomp ->
	  expcomp _ "<" _ expsum {% func %}
	| expcomp _ ">" _ expsum {% func %}
	| expcomp _ "<=" _ expsum {% func %}
	| expcomp _ ">=" _ expsum {% func %}
	| expcomp _ "!=" _ expsum {% func %}
	| expcomp _ "==" _ expsum {% func %}
	| expsum {% id %}

expsum ->
	  expsum _ "+" _ expprod {% func %}
	| expsum _ "-" __ expprod {% func %}
	| expprod {% id %}

expprod ->
	  expprod _ "/" _ expuni {% func %}
	| expprod _ "%" _ expuni {% func %}
	| expuni {% id %}

expuni ->
	  (expuni | func) __ exppow {% x => [x[0][0], x[2]] %}
  | exppow _ "." _ (expuni | func) {% x => [x[4][0], x[0]] %}
	| exppow {% id %}

exppow ->
    exppow _ "^" _ expcall {% func %}
  | expcall {% id %}

expcall ->
  	(expcall | func | minus) atom {% x => [x[0][0], x[1]] %}
	| atom {% id %}

func ->
    ("!" | "*") {% x => ({ type: "function", value: x[0][0].value }) %}

minus ->
    "-" {% x => ({ type: "value", value: -1 }) %}

atom ->
    (table | group | value | context) {% x => x[0][0] %}

value ->
    (%value | %string) {% x => ({ type: "value", value: x[0][0].value }) %}

context ->
    "@" {% x => ({ type: "context" }) %}

_ ->
  %_:? {% () => null %}
__ ->
  %_ {% () => null %}