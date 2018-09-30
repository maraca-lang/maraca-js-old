@{%
const lexer = require('./lexer').default;
const core = x => [[{ type: "core", value: x[2].value }, x[0]], x[4]];
%}
@lexer lexer

main ->
    _ body _ {% x => x[1] %}

table ->
    "[*" _ line _ "," _ body _ "]"
      {% x => ({
        type: "table",
        value: [...x[6], [{ type: "core", value: "[*" }, x[2]]]
      }) %}
  | "[*" _ line _ "]"
      {% x => ({
        type: "table",
        value: [[{ type: "core", value: "[*" }, x[2]]]
      }) %}
  | "[" _ body _ "," _ line _ "*]"
      {% x => ({
        type: "table",
        value: [...x[2], [{ type: "core", value: "*]" }, x[6]]]
      }) %}
  | "[" _ line _ "*]"
      {% x => ({
        type: "table",
        value: [[{ type: "core", value: "*]" }, x[2]]]
      }) %}
  | "[" _ body _ "]"
      {% x => ({ type: "table", value: x[2] }) %}

body ->
    body _ "," _ line
      {% x => [...x[0], [{ type: 'core', value: '::' }, x[4]]] %}
  | line {% x => [[{ type: 'core', value: '::' }, x[0]]] %}

line ->
    exp {% id %}
  | _ {% x => ({ type: "nil" }) %}

group ->
    "(" _ exp _ ")" {% x => x[2] %}

exp ->
    expemit {% id %}

expemit ->
    expeq _ ">>" _ expeq {% core %}
  | expeq {% id %}

expeq ->
    expeq _ ":=" _ expfunc {% core %}
  | expfunc {% id %}

expfunc ->
    expfunc _ "=>" _ expid
      {% x => ({ type: "function", value: { input: x[0], output: x[4] } }) %}
  | expid {% id %}

expid ->
    expid _ "~" _ expor {% core %}
  | expor {% id %}

expor ->
    expor _ "or" _ expand {% core %}
  | expand {% id %}

expand ->
    expand _ "and" _ expcomp {% core %}
  | expcomp {% id %}

expcomp ->
	  expcomp _ "<" _ expconc {% core %}
	| expcomp _ ">" _ expconc {% core %}
	| expcomp _ "<=" _ expconc {% core %}
	| expcomp _ ">=" _ expconc {% core %}
	| expcomp _ "!=" _ expconc {% core %}
	| expcomp _ "=" _ expconc {% core %}
	| expconc {% id %}

expconc ->
	  expconc _ ".." _ expsum {% core %}
	| expsum {% id %}

expsum ->
	  expsum _ "+" _ expprod {% core %}
	| expsum _ "-" _ expprod {% core %}
	| expprod {% id %}

expprod ->
    expprod _ "*" _ expmerge {% core %}
	| expprod _ "/" _ expmerge {% core %}
	| expprod _ "%" _ expmerge {% core %}
	| expmerge {% id %}

expmerge ->
	  expmerge _ "&" _ expuni {% core %}
	| expuni {% id %}

expuni ->
	  (expuni | func) _ exppow {% x => [x[0][0], x[2]] %}
  | (expuni | func) _ ":" _ exppow {% x => [x[4], x[0][0]] %}
	| exppow {% id %}

exppow ->
    exppow _ "^" _ atom {% core %}
  | atom {% id %}

expcall ->
  	(expcall | func) atom {% x => [x[0][0], x[1]] %}
  | atom {% id %}

func ->
    ("not" | "@") {% x => ({ type: "core", value: x[0][0].value }) %}
  | "*" {% x => ({ type: "core", value: "unpack" }) %}

atom ->
    (table | group | value | minus | context) {% x => x[0][0] %}

value ->
    (%value | %string) {% x => x[0][0].value %}

minus ->
   "-" {% x => ({ type: "string", value: "-" }) %}

context ->
    "?" {% x => ({ type: "context" }) %}

_ ->
  %_:? {% () => null %}
__ ->
  %_ {% () => null %}