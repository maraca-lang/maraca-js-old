@{%
const lexer = require("./lang/lexer").default;
const core = x => ({ type: "core", func: x[2][0].value, args: [x[0], x[4]] });
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
      {% x => ({
        type: "set",
        args: [{ type: "combine", args: [x[0], { type: "context" }] }, x[0]],
      }) %}
  | expset _ ":="
      {% x => ({ type: "set", args: [x[0], x[0]] }) %}
  | expid _ ":" _ expset
      {% x => ({ type: "set", args: [x[4], x[0]] }) %}
  | ":" _ expset
      {% x => ({ type: "set", args: [x[2], { type: "nil" }] }) %}
  | expid _ "::" _ expset
      {% x => ({ type: "set", unpack: true, args: [x[4], x[0]] }) %}
  | "::" _ expset
      {% x => ({ type: "set", unpack: true, args: [x[2]] }) %}
  | expid {% id %}

expid ->
    expid _ ("~") _ expnot {% core %}
  | expnot {% id %}

expnot ->
    "!" _ expcomp
      {% x => ({ type: "core", func: x[0].value, args: [x[2]] }) %}
	| expcomp {% id %}

expcomp ->
	  expcomp _ ("<" | ">" | "<=" | ">=" | "!" | "==" | "=") _ expsum
      {% core %}
	| expsum {% id %}

expsum ->
	  expsum _ ("+" | "-") _ expprod {% core %}
	| expprod {% id %}

expprod ->
    expprod _ ("*" | "/" | "%") _ expmerge {% core %}
	| expmerge {% id %}

expmerge ->
	  expmerge _ "&" _ exppow {% x => ({ type: "merge", args: [x[0], x[4]] }) %}
	| exppow {% id %}

exppow ->
    exppow _ ("^") _ expuni {% core %}
  | expuni {% id %}

expuni ->
    ("@@" | "@" | "-") _ expcomb2
      {% x => ({ type: "core", func: x[0][0].value, args: [x[2]] }) %}
  | "##" _ atom _ expcomb2 
      {% x => ({ type: "eval", code: x[2], arg: x[4] }) %}
  | "##" _ atom 
      {% x => ({ type: "eval", code: x[2], arg: { type: "nil" } }) %}
  | "#" _ atom _ expcomb2 
      {% x => ({ type: "js", code: x[2], arg: x[4] }) %}
  | "#" _ atom 
      {% x => ({ type: "js", code: x[2], arg: { type: "nil" } }) %}
	| expcomb2 {% id %}

expcomb2 ->
	  expcomb2 _ "." _ expcomb1
      {% x => ({ type: "combine", tight: true, args: [x[0], x[4]] }) %}
	| expcomb1 {% id %}

expcomb1 ->
	  expcomb1 _ atom {% x => ({ type: "combine", args: [x[0], x[2]] }) %}
	| atom {% id %}

atom -> (list | value | any | context) {% x => x[0][0] %}

list ->
    (("[" body "]") | ("(" body ")") | ("{" body "}"))
      {% x => ({
        type: "list",
        bracket: x[0][0][0].text,
        values: x[0][0][1],
      }) %}

body ->
    body "," line {% x => [...x[0], x[2]] %}
  | line {% x => [x[0]] %}

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