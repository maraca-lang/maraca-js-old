@{%
const lexer = require('./lexer').default;
const map = x => ({ type: "map", map: x[2].value, args: [x[0], x[4]] });
%}
@lexer lexer

exp ->
    expset {% id %}

expset ->
    expeq _ ":=" {% x => ({ type: "assign", key: x[0], value: x[0] }) %}
  | expeq _ %copy
      {% x =>
        ({ type: "assign", key: x[0], value: [x[0], { type: "context" }] })
      %}
  | %fill _ expeq
      {% x =>
        ({ type: "assign", key: { type: "any", group: true }, value: x[2] })
      %}
  | expeq {% id %}

expeq ->
    expfunc _ ":=" _ expeq
      {% x => ({ type: "assign", key: x[0], value: x[4] }) %}
  | expfunc {% id %}

expfunc ->
    expfunc _ "=>" _ expid
      {% x => ({ type: "function", input: x[0], output: x[4] }) %}
  | expid {% id %}

expid ->
    expid _ "~" _ expor {% map %}
  | expor {% id %}

expor ->
    expor _ "or" _ expand {% map %}
  | expand {% id %}

expand ->
    expand _ "and" _ expcomp {% map %}
  | expcomp {% id %}

expcomp ->
	  expcomp _ "<" _ expconc {% map %}
	| expcomp _ ">" _ expconc {% map %}
	| expcomp _ "<=" _ expconc {% map %}
	| expcomp _ ">=" _ expconc {% map %}
	| expcomp _ "!=" _ expconc {% map %}
	| expcomp _ "=" _ expconc {% map %}
	| expconc {% id %}

expconc ->
	  expconc _ "|" _ expsum {% map %}
	| expsum {% id %}

expsum ->
	  expsum _ "+" _ expprod {% map %}
	| expsum _ "-" _ expprod {% map %}
	| expprod {% id %}

expprod ->
    expprod _ "*" _ expmerge {% map %}
	| expprod _ "/" _ expmerge {% map %}
	| expprod _ "%" _ expmerge {% map %}
	| expmerge {% id %}

expmerge ->
	  expmerge _ "&" _ expuni {% x => ({ type: "merge", args: [x[0], x[4]] }) %}
	| expuni {% id %}

expuni ->
	  (expuni | func) __ exppow {% x => [x[0][0], x[2]] %}
  | (expuni | func) _ ":" _ exppow {% x => [x[4], x[0][0]] %}
	| map _ exppow {% x => ({ type: "map", map: x[0], args: [x[2]] }) %}
  | map _ ":" _ exppow {% x => ({ type: "map", map: x[4], args: [x[0]] }) %}
	| exppow {% id %}

exppow ->
    exppow _ "^" _ expcall {% map %}
  | expcall {% id %}

expcall ->
  	(expcall | func) atom {% x => [x[0][0], x[1]] %}
  |	map atom {% x => ({ type: "map", map: x[0], args: [x[1]] }) %}
  | atom {% id %}

func ->
    "#" {% x => ({ type: "count" }) %}
  | "@" {% x => ({ type: "date" }) %}

map ->
    "not" {% x => x[0].value %}
  | "-" {% x => "-1" %}

atom ->
    (table | group | value | any | nil | context) {% x => x[0][0] %}

table ->
    "[" _ body _ "]"
      {% x => ({ type: "table", values: x[2] }) %}

body ->
    body _ "," _ line
      {% x => [...x[0], { type: 'assign', value: x[4] }] %}
  | line {% x => [{ type: 'assign', value: x[0] }] %}

line ->
    exp {% id %}
  | _ {% x => ({ type: "nil" }) %}

group ->
    "(" _ exp _ ")" {% x => x[2] %}

value ->
    (%value | %string) {% x => x[0][0].value %}

any ->
    "*" {% x => ({ type: "any" }) %}

nil ->
    "nil" {% x => ({ type: "nil" }) %}

context ->
    "?" {% x => ({ type: "context" }) %}

_ ->
  %_:? {% () => null %}
__ ->
  %_ {% () => null %}