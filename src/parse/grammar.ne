@{%
const lexer = require("./parse/lexer").default;
const core = x => ({
  type: "core",
  nodes: [x[0], x[4]],
  info: { func: x[2][0].text },
  start: x[0].start,
  end: x[4].end,
});
%}
@lexer lexer

main ->
    _ exp _ {% x => x[1] %}

exp ->
    expfunc {% id %}

expfunc ->
    expset _ "=>" _ expset _ "=>" _ expset
      {% x => ({
        type: "func",
        nodes: [x[4], x[0], x[8]],
        info: { map: true },
        start: x[0].start,
        end: x[8].end,
      }) %}
  | expset _ "=>>" _ expset
      {% x => ({
        type: "func",
        nodes: [null, x[0], x[4]],
        info: { map: true },
        start: x[0].start,
        end: x[4].end,
      }) %}
  | expset _ "=>" _ expset
      {% x => ({
        type: "func",
        nodes: [null, x[0], x[4]],
        start: x[0].start,
        end: x[4].end,
      }) %}
  | "=>>" _ expset
      {% x => ({
        type: "func",
        nodes: [null, null, x[2]],
        info: { map: true },
        start: x[0].offset,
        end: x[2].end,
      }) %}
  | "=>" _ expset
      {% x => ({
        type: "func",
        nodes: [null, null, x[2]],
        start: x[0].offset,
        end: x[2].end,
      }) %}
  | expset {% id %}

expset ->
    expset _ ":=?"
      {% x => ({
        type: "assign",
        nodes: [{ type: "combine", nodes: [x[0], { type: "context" }] }, x[0]],
        start: x[0].start,
        end: x[2].offset + x[2].text.length,
      }) %}
  | expset _ ":="
      {% x => ({
        type: "assign",
        nodes: [x[0], x[0]],
        start: x[0].start,
        end: x[2].offset + x[2].text.length,
      }) %}
  | exppush _ ":" _ expset
      {% x => ({
        type: "assign",
        nodes: [x[4], x[0]],
        start: x[0].start,
        end: x[4].end,
      }) %}
  | expset _ ":"
      {% x => ({
        type: "assign",
        nodes: [{ type: "nil" }, x[0]],
        start: x[0].start,
        end: x[2].offset + x[2].text.length,
      }) %}
  | ":" _ expset
      {% x => ({
        type: "assign",
        nodes: [x[2], { type: "nil" }],
        start: x[0].offset,
        end: x[2].end,
      }) %}
  | exppush {% id %}

exppush ->
    exppush _ "->" _ expeval
      {% x => ({
        type: "push",
        nodes: [x[0], x[4]],
        start: x[0].start,
        end: x[4].end,
      }) %}
  | expeval {% id %}

expeval ->
    expeval _ ("$") _ exptrigger {% core %}
  | exptrigger {% id %}

exptrigger ->
    exptrigger _ ("|") _ expnot {% core %}
  | expnot {% id %}

expnot ->
    "!" _ expcomp
      {% x => ({
        type: "core",
        nodes: [x[2]],
        info: { func: x[0].text },
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
        nodes: [x[2]],
        info: { func: x[0].text },
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
    ("@@@" | "@@" | "@") _ expsep
      {% x => ({
        type: "interpret",
        nodes: [x[2]],
        info: { level: x[0][0].text.length },
        start: x[0][0].offset,
        end: x[2].end,
      }) %}
	| expsep {% id %}

expsep ->
	  expsep _ "." _ expcomb
      {% x => ({
        type: "combine",
        nodes: [
          ...(x[0].type === "combine" && x[0].info.dot ? x[0].nodes : [x[0]]),
          x[4]
        ],
        info: { dot: true },
        start: x[0].start,
        end: x[4].end,
      }) %}
	| expcomb {% id %}

expcomb ->
	  expcomb _ lib
      {% x => ({
        type: "combine",
        nodes: [...(x[0].type === "combine" ? x[0].nodes : [x[0]]), x[2]],
        info: {
          space: [...(x[0].type === "combine" ? x[0].info.space : []), !!x[1]]
        },
        start: x[0].start,
        end: x[2].end,
      }) %}
  | lib {% id %}

lib ->
    "#" _ atom 
      {% x => ({
        type: "library",
        nodes: [x[2]],
        start: x[0].offset,
        end: x[2].end,
      }) %}
  | atom {% id %}

atom -> (list | value | space | identity | context) {% x => x[0][0] %}

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
          nodes: x[0][0][1],
          info: { bracket: x[0][0][0].text },
          start: x[0][0][0].offset,
          end: x[0][0][2].offset + x[0][0][2].text.length,
        });
      } %}

body ->
    body "," line
      {% x => x[2].length === 1
        ? [...x[0], {
            ...x[2][0],
            start: x[2][0].start || x[1].offset,
            end: x[2][0].end || (x[1].offset + x[1].text.length),
          }]
        : [...x[0], ...x[2]] %}
  | line {% x => x[0] %}

line ->
    _ string _ {% (x, _, reject) => {
      if (x[1].length <= 1) return reject;
      const result = x[1].map(y => {
        y.info = y.info || {};
        return y;
      });
      result[0].info.first = true;
      result[result.length - 1].info.last = true;
      return result;
    } %}
  | _ exp _ {% x => [x[1]] %}
  | _ {% x => [{ type: "nil" }] %}

value ->
    (valueitem | stringsingle)
      {% x => x[0][0] %}

valueitem ->
    (%char | %value | %comment)
      {% x => ({
        ...x[0][0].value,
        start: x[0][0].offset,
        end: x[0][0].offset + x[0][0].text.length,
      }) %}

stringsingle ->
    string
      {% (x, _, reject) => {
        if (x[0].length > 1) return reject;
        if (x[0].length === 0) return { type: "nil" };
        return {
          ...x[0][0],
          info: { ...x[0][0].info, first: true, last: true },
        };
      } %}
  | %string
      {% x => ({
        ...x[0].value,
        start: x[0].offset,
        end: x[0].offset + x[0].text.length,
      }) %}

string ->
    "'" stringitem:* "'"
      {% x => x[1].reduce((res, y) => {
        if (y.type !== "value") return [...res, y];
        return [
          ...res,
          ...y.info.value.split(/￿/g).map((s, i) =>
            ({ type: "value", info: { value: s, split: i !== 0 } })
          ),
        ];
      }, []) %}

stringitem ->
    (stringcontent | stringlist)
      {% x => x[0][0] %}

stringcontent ->
    %content
      {% x => ({
        ...x[0].value,
        start: x[0].offset,
        end: x[0].offset + x[0].text.length,
      }) %}

stringlist ->
    "<" body "/>"
      {% x => {
        const values = x[1];
        let i = values.length - 1;
        while (i >= 0 && values[i].type === "nil") {
          values.pop();
          i--;
        }
        return ({
          type: "list",
          nodes: x[1],
          info: { bracket: "<" },
          start: x[0].offset,
          end: x[2].offset + x[2].text.length,
        });
      } %}

space ->
    "_"
      {% x => ({
        type: "value",
        info: { value: " " },
        start: x[0].offset,
        end: x[0].offset + x[0].text.length,
      }) %}

identity ->
    "~"
      {% x => ({
        type: "identity",
        start: x[0].offset,
        end: x[0].offset + x[0].text.length,
      }) %}

context ->
    "?"
      {% x => ({
        type: "context",
        start: x[0].offset,
        end: x[0].offset + x[0].text.length,
      }) %}

_ ->
  %_:? {% id %}
