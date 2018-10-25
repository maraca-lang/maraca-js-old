@{%
const lexer = require('./lang/lexer').default;
const binary = x =>
  ({ type: "binary", func: x[2][0].value, args: [x[0], x[4]] });
%}
@lexer lexer

main ->
    _ exp _ {% x => x[1] %}

exp ->
    expother {% id %}

expother ->
    expset _ "=>" _ expset _ "=>" _ expset
      {% x => ({ type: "other", key: x[0], value: x[4], output: x[8] }) %}
  | expset _ "=>>" _ expset
      {% x => ({ type: "other", value: x[0], output: x[4] }) %}
  | expset _ "=>" _ expset
      {% x => ({ type: "other", key: x[0], output: x[4] }) %}
  | "=>>" _ expset
      {% x => ({ type: "other", value: true, output: x[2] }) %}
  | "=>" _ expset
      {% x => ({ type: "other", key: true, output: x[2] }) %}
  | expset {% id %}

expset ->
    expset _ ":=?"
      {% x =>
        ({ type: "set", key: x[0], value: [x[0], { type: "context" }] })
      %}
  | expset _ ":="
      {% x => ({ type: "set", key: x[0], value: x[0] }) %}
  | expid _ ":" _ expset
      {% x => ({ type: "set", key: x[0], value: x[4] }) %}
  | "::" _ expset
      {% x => ({ type: "set", value: x[2] }) %}
  | ":" _ expset
      {% x => ({ type: "set", key: { type: "nil" }, value: x[2] }) %}
  | "..." _ expset
      {% x => ({ type: "set", key: true, value: x[2] }) %}
  | expid {% id %}

expid ->
    expid _ ("~") _ expnot {% binary %}
  | expnot {% id %}

expnot ->
    "!" _ expcomp
      {% x => ({ type: "unary", func: x[0].value, arg: x[2] }) %}
	| expcomp {% id %}

expcomp ->
	  expcomp _ ("<" | ">" | "<=" | ">=" | "!" | "==" | "=") _ expconc
      {% binary %}
	| expconc {% id %}

expconc ->
	  expconc _ ("..") _ expsum {% binary %}
	| expsum {% id %}

expsum ->
	  expsum _ ("+" | "-") _ expprod {% binary %}
	| expprod {% id %}

expprod ->
    expprod _ ("*" | "/" | "%") _ expmerge {% binary %}
	| expmerge {% id %}

expmerge ->
	  expmerge _ "&" _ exppow {% x => ({ type: "merge", args: [x[0], x[4]] }) %}
	| exppow {% id %}

exppow ->
    exppow _ ("^") _ expuni {% binary %}
  | expuni {% id %}

expuni ->
    ("@@" | "@" | "-") _ expcomb
      {% x => ({ type: "unary", func: x[0][0].value, arg: x[2] }) %}
  | "##" _ atom _ expcomb 
      {% x => ({ type: "eval", code: x[2], arg: x[4] }) %}
  | "#" _ atom _ expcomb 
      {% x => ({ type: "js", code: x[2], arg: x[4] }) %}
	| expcomb {% id %}

expcomb ->
	  expcomb _ atom {% x => [x[0], x[2]] %}
	| atom {% id %}

atom -> (list | value | any | context) {% x => x[0][0] %}

list ->
    "[" body "]" {% x => ({ type: "list", values: x[1] }) %}
  | "(" body ")"
      {% x => [
        { type: "string", value: x[1].length.toString() },
        { type: "list", values: x[1] }
      ] %}
  | "{" body "}"
      {% x => [
        { type: "string", value: "1" },
        { type: "list", values: x[1] }
      ] %}

body ->
    body "," line
      {% x => [...x[0], { type: 'set', value: x[2] }] %}
  | line {% x => [{ type: 'set', value: x[0] }] %}

line ->
    _ exp _ {% x => x[1] %}
  | _ {% x => ({ type: "nil" }) %}

value ->
    (%value | %string) {% x => x[0][0].value %}

any ->
    "*" {% x => ({ type: "any" }) %}

context ->
    "?" {% x => ({ type: "context" }) %}

_ ->
  %_:? {% () => null %}