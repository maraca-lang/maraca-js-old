@{%
const lexer = require("./parse/lexer").default;
const core = x => ({
  type: "core",
  func: x[2][0].text,
  args: [x[0], x[4]],
  start: x[0].start,
  end: x[4].end,
});
%}
@lexer lexer

main ->
    _ exp _ {% x => x[1] %}

exp ->
    expother {% id %}

expother ->
    expset _ "=>" _ expset _ "=>" _ expset
      {% x => ({
        type: "other",
        map: true,
        key: x[0],
        value: x[4],
        output: x[8],
        start: x[0].start,
        end: x[8].end,
      }) %}
  | expset _ "=>>" _ expset
      {% x => ({
        type: "other",
        map: true,
        value: x[0],
        output: x[4],
        start: x[0].start,
        end: x[4].end,
      }) %}
  | expset _ "=>" _ expset
      {% x => ({
        type: "other",
        value: x[0],
        output: x[4],
        start: x[0].start,
        end: x[4].end,
      }) %}
  | "=>>" _ expset
      {% x => ({
        type: "other",
        map: true,
        output: x[2],
        start: x[0].offset,
        end: x[2].end,
      }) %}
  | "=>" _ expset
      {% x => ({
        type: "other",
        output: x[2],
        start: x[0].offset,
        end: x[2].end,
      }) %}
  | expset {% id %}

expset ->
    expset _ ":=?"
      {% x => ({
        type: "set",
        args: [{ type: "combine", args: [x[0], { type: "context" }] }, x[0]],
        start: x[0].start,
        end: x[2].offset + x[2].text.length,
      }) %}
  | expset _ ":="
      {% x => ({
        type: "set",
        args: [x[0], x[0]],
        start: x[0].start,
        end: x[2].offset + x[2].text.length,
      }) %}
  | expid _ ":" _ expset
      {% x => ({
        type: "set",
        args: [x[4], x[0]],
        start: x[0].start,
        end: x[4].end,
      }) %}
  | expset _ ":"
      {% x => ({
        type: "set",
        args: [{ type: "nil" }, x[0]],
        start: x[0].start,
        end: x[2].offset + x[2].text.length,
      }) %}
  | ":" _ expset
      {% x => ({
        type: "set",
        args: [x[2], { type: "nil" }],
        start: x[0].offset,
        end: x[2].end,
      }) %}
  | expid _ "::" _ expset
      {% x => ({
        type: "set",
        unpack: true,
        args: [x[4], x[0]],
        start: x[0].start,
        end: x[4].end,
      }) %}
  | "::" _ expset
      {% x => ({
        type: "set",
        unpack: true,
        args: [x[2]],
        start: x[0].offset,
        end: x[2].end,
      }) %}
  | expid {% id %}

expid ->
    expid _ ("~") _ exptight {% core %}
  | exptight {% id %}

exptight ->
	  exptight _ "." _ expnot
      {% x => ({
        type: "combine",
        tight: true,
        args: [...(x[0].tight ? x[0].args : [x[0]]), x[4]],
        start: x[0].start,
        end: x[4].end,
      }) %}
	| expnot {% id %}

expnot ->
    "!" _ expcomp
      {% x => ({
        type: "core",
        func: x[0].text,
        args: [x[2]],
        start: x[0].offset,
        end: x[2].end,
      }) %}
	| expcomp {% id %}

expcomp ->
	  expcomp _ ("<" | ">" | "<=" | ">=" | "!" | "==" | "=") _ expsum {% core %}
	| expsum {% id %}

expsum ->
	  expsum _ ("+" | "-") _ expprod {% core %}
  | "-" _ expprod
      {% x => ({
        type: "core",
        func: x[0].text,
        args: [x[2]],
        start: x[0].offset,
        end: x[2].end,
      }) %}
	| expprod {% id %}

expprod ->
    expprod _ ("*" | "/" | "%") _ exppow {% core %}
	| exppow {% id %}

exppow ->
    exppow _ ("^") _ expdyn {% core %}
  | expdyn {% id %}

expdyn ->
    ("@@@" | "@@" | "@") _ expcomb
      {% x => ({
        type: "dynamic",
        level: x[0][0].text.length,
        arg: x[2],
        start: x[0][0].offset,
        end: x[2].end,
      }) %}
	| expcomb {% id %}

expcomb ->
	  expcomb _ atom
      {% x => ({
        type: "combine",
        args: [...(x[0].type === "combine" ? x[0].args : [x[0]]), x[2]],
        start: x[0].start,
        end: x[2].end,
      }) %}
  | atom {% id %}

atom -> (list | eval | value | context) {% x => x[0][0] %}

list ->
    (("[" body "]") | ("(" body ")") | ("{" body "}"))
      {% x => {
        const values = x[0][0][1];
        let i = values.length - 1;
        while (i >= 0 && values[i].type === "nil") {
          values.pop();
          i--;
        }
        return ({
          type: "list",
          bracket: x[0][0][0].text,
          values: x[0][0][1],
          start: x[0][0][0].offset,
          end: x[0][0][2].offset + x[0][0][2].text.length,
        });
      } %}

body ->
    body "," line {% x => [...x[0], {
      ...x[2],
      break: false,
      start: x[2].start || x[1].offset,
      end: x[2].end || (x[1].offset + x[1].text.length),
    }] %}
  | line {% x => [x[0]] %}

line ->
    _ exp _ {% x => ({ ...x[1], break: x[0] && x[0].lineBreaks > 0 }) %}
  | _ {% x => ({ type: "nil" }) %}

eval ->
    ("#" | "##") _ atom 
      {% x => ({
        type: "eval",
        mode: x[0][0].text,
        code: x[2],
        start: x[0][0].offset,
        end: x[2].end,
      }) %}

value ->
    (%value | %string)
      {% x => ({
        ...x[0][0].value,
        start: x[0][0].offset,
        end: x[0][0].offset + x[0][0].text.length,
      }) %}

context ->
    "?" {% x => ({
      type: "context",
      start: x[0].offset,
      end: x[0].offset + x[0].text.length,
    }) %}

_ ->
  %_:? {% id %}