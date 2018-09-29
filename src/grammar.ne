@{%
const lexer = require('./lexer').default;
const func = x => [[{ type: "function", value: x[2].value }, x[0]], x[4]];
%}
@lexer lexer

main ->
    _ body _ {% x => x[1] %}
  | _ {% () => [] %}

table ->
    "[*" _ exp _ "," _ body _ "]"
      {% x => ({ type: "table", value: { default: x[2], content: x[6] } }) %}
  | "[*" _ exp _ "]"
      {% () => ({ type: "value", value: { default: x[2], content: [] } }) %}
  | "[" _ body _ "]"
      {% x => ({
        type: "table",
        value: { default: { type: "value", value: null }, content: x[2] }
      }) %}
  | "[" _ "]"
      {% () => ({ type: "value", value: null }) %}

body ->
    body _ "," _ line {% x => [...x[0], x[4]] %}
  | line {% x => [x[0]] %}

line ->
    exp {% id %}
  | _ {% x => ({ type: "blank" }) %}

group ->
    "(" _ exp _ ")" {% x => x[2] %}

exp ->
    expeq {% id %}

expeq ->
    expeq _ "::" _ expfunc {% func %}
  | expfunc {% id %}

expfunc ->
    expfunc _ "=>" _ expid
      {% x => ({ type: "define", value: { input: x[0], output: x[4] } }) %}
  | expid {% id %}

expid ->
    expid _ "~" _ expor {% func %}
  | expor {% id %}

expor ->
    expor _ "or" _ expand {% func %}
  | expand {% id %}

expand ->
    expand _ "and" _ expcomp {% func %}
  | expcomp {% id %}

expcomp ->
	  expcomp _ "<" _ expconc {% func %}
	| expcomp _ ">" _ expconc {% func %}
	| expcomp _ "<=" _ expconc {% func %}
	| expcomp _ ">=" _ expconc {% func %}
	| expcomp _ "!=" _ expconc {% func %}
	| expcomp _ "=" _ expconc {% func %}
	| expconc {% id %}

expconc ->
	  expconc _ ".." _ expsum {% func %}
	| expsum {% id %}

expsum ->
	  expsum _ "+" _ expprod {% func %}
	| expsum _ "-" __ expprod {% func %}
	| expprod {% id %}

expprod ->
    expprod _ "*" _ expuni {% func %}
	| expprod _ "/" _ expuni {% func %}
	| expprod _ "%" _ expuni {% func %}
	| expuni {% id %}

expuni ->
	  (expuni | func) __ exppow {% x => [x[0][0], x[2]] %}
  | exppow _ ":" _ (expuni | func) {% x => [x[4][0], x[0]] %}
	| exppow {% id %}

exppow ->
    exppow _ "^" _ expcall {% func %}
  | expcall {% id %}

expcall ->
  	(expcall | func) atom {% x => [x[0][0], x[1]] %}
  | atom {% id %}

func ->
    ("not" | "&" | "@") {% x => ({ type: "function", value: x[0][0].value }) %}

concat ->
    concat _ value {% x => [x[0], x[2]] %}
  | value {% id %}

atom ->
    (table | group | value | string | minus | wildcard | context)
      {% x => x[0][0] %}

value ->
    %value {% x => ({ type: "value", value: x[0].value }) %}

string ->
    %string {% x => ({ type: "value", value: x[0].value }) %}

minus ->
    "-" {% x => ({ type: "value", value: -1 }) %}

wildcard ->
    "*" {% x => ({ type: "wildcard" }) %}

context ->
    "?" {% x => ({ type: "context" }) %}

_ ->
  %_:? {% () => null %}
__ ->
  %_ {% () => null %}