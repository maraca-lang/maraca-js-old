@{%
const lexer = require('./lexer').default;
const map = x => ({ type: "map", map: x[2].value, args: [x[0], x[4]] });
%}
@lexer lexer

exp ->
    expset {% id %}

expset ->
    expeq _ "=:?"
      {% x =>
        ({ type: "assign", key: x[0], value: [x[0], { type: "context" }] })
      %}
  | expeq _ "=:"
      {% x => ({ type: "assign", key: x[0], value: x[0] }) %}
  | %fill _ expeq
      {% x =>
        ({ type: "assign", key: { type: "any", group: true }, value: x[2] })
      %}
  | expeq {% id %}

expeq ->
    expid _ ":=" _ expeq
      {% x => ({ type: "assign", key: x[0], value: x[4] }) %}
  | ":=" _ expeq
      {% x => ({ type: "assign", value: x[2] }) %}
  | expid _ "=>" _ expeq
      {% x => ({ type: "function", input: x[0], output: x[4] }) %}
  | "=>" _ expeq
      {% x => ({ type: "function", output: x[2] }) %}
  | expid {% id %}

expid ->
    expid _ "~" _ expcomp {% map %}
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
	  expconc _ "_" _ expsum {% map %}
  | expconc _ "|" _ expsum {% map %}
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
	  expuni __ exppow {% x => [x[0], x[2]] %}
  | expuni _ ":" _ exppow {% x => [x[4], x[0]] %}
	| func __ exppow {% x => ({ type: x[0], arg: x[2] }) %}
  | exppow _ ":" _ func {% x => ({ type: x[4], arg: x[0] }) %}
	| map _ exppow {% x => ({ type: "map", map: x[0], args: [x[2]] }) %}
  | exppow _ ":" _ map {% x => ({ type: "map", map: x[4], args: [x[0]] }) %}
	| exppow {% id %}

exppow ->
    exppow _ "^" _ expcall {% map %}
  | expcall {% id %}

expcall ->
  	atom expcall {% x => [x[0], x[1]] %}
  | func expcall {% x => ({ type: x[0], arg: x[1] }) %}
  |	map expcall {% x => ({ type: "map", map: x[0], args: [x[1]] }) %}
  | atom {% id %}

func ->
    "#" {% () => "count" %}
  | "@" {% () => "date" %}

map ->
    "!" {% x => x[0].value %}
  | "-" {% x => "minus" %}

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
      {% x => [...x[0], { type: 'assign', value: x[4] }] %}
  | line {% x => [{ type: 'assign', value: x[0] }] %}

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