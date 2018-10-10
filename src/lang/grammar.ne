@{%
const lexer = require('./lang/lexer').default;
const binary = x =>
  ({ type: "binary", func: x[2][0].value, args: [x[0], x[4]] });
%}
@lexer lexer

main ->
    _ exp _ {% x => x[1] %}

exp ->
    expset {% id %}

expset ->
    expset _ "=:?"
      {% x =>
        ({ type: "set", key: x[0], value: [x[0], { type: "context" }] })
      %}
  | expset _ "=:"
      {% x => ({ type: "set", key: x[0], value: x[0] }) %}
  | expid _ ":=" _ expset
      {% x => ({ type: "set", key: x[0], value: x[4] }) %}
  | ":=" _ expset
      {% x => ({ type: "set", value: x[2] }) %}
  | ".." _ expset
      {% x => ({ type: "set", key: true, value: x[4] }) %}
  | expid _ "=>" _ expid _ "=>" _ expset
      {% x => ({ type: "other", key: x[0], value: x[4], output: x[8] }) %}
  | expid _ "=>>" _ expset
      {% x => ({ type: "other", value: x[0], output: x[4] }) %}
  | expid _ "=>" _ expset
      {% x => ({ type: "other", key: x[0], output: x[4] }) %}
  | "=>>" _ expset
      {% x => ({ type: "other", value: true, output: x[2] }) %}
  | "=>" _ expset
      {% x => ({ type: "other", key: true, output: x[2] }) %}
  | expid {% id %}

expid ->
    expid _ ("~") _ expcomp {% binary %}
  | expcomp {% id %}

expcomp ->
	  expcomp _ ("<" | ">" | "<=" | ">=" | "!=" | "=") _ expconc {% binary %}
	| expconc {% id %}

expconc ->
	  expconc _ ("_" | "&") _ expsum {% binary %}
	| expsum {% id %}

expsum ->
	  expsum _ ("+" | "-") _ expprod {% binary %}
	| expprod {% id %}

expprod ->
    expprod _ ("*" | "/" | "%") _ expmerge {% binary %}
	| expmerge {% id %}

expmerge ->
	  expmerge _ "|" _ expdo2 {% x => ({ type: "merge", args: [x[0], x[4]] }) %}
	| expdo2 {% id %}

expdo2 ->
	  expdo2 __ exppow {% x => [x[0], x[2]] %}
  | expdo2 _ ":" _ exppow {% x => [x[0], x[4]] %}
	| exppow {% id %}

exppow ->
    exppow _ ("^") _ expdo1 {% binary %}
  | expdo1 {% id %}

expdo1 ->
  	expdo1 atom {% x => [x[0], x[1]] %}
  | ("#" | "@" | "!" | "-") _ expdo1
      {% x => ({ type: "unary", func: x[0][0].value, arg: x[2] }) %}
  | atom {% id %}

atom -> (table | value | any | context) {% x => x[0][0] %}

table ->
    "[" _ body _ "]" {% x => ({ type: "table", values: x[2] }) %}
  | "(" _ body _ ")"
      {% x => [
        { type: "string", value: x[2].length.toString() },
        { type: "table", values: x[2] }
      ] %}
  | "{" _ body _ "}"
      {% x => [
        { type: "string", value: "1" },
        { type: "table", values: x[2] }
      ] %}

body ->
    body _ "," _ line
      {% x => [...x[0], { type: 'set', value: x[4] }] %}
  | line {% x => [{ type: 'set', value: x[0] }] %}

line ->
    exp {% id %}
  | _ {% x => ({ type: "nil" }) %}

value ->
    (%value | %string) {% x => x[0][0].value %}

any ->
    "*" {% x => ({ type: "any" }) %}

context ->
    "?" {% x => ({ type: "context" }) %}

_ ->
  %_:? {% () => null %}
__ ->
  %_ {% () => null %}