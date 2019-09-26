export default `Maraca {

  Exp
    = ExpFunc

  ExpFunc
    = ExpSet "=>" ExpSet "=>" ExpSet -- map_all
    | ExpSet "=>>" ExpSet -- map_one
    | ExpSet "=>" ExpSet -- func_one
    | "=>>" ExpSet -- map
    | "=>" ExpSet -- func
    | ExpSet

  ExpSet
    = ExpSet ":=?" -- short_context
    | ExpSet ":=" -- short_value
    | ExpPush ":" ExpSet -- normal
    | ExpSet ":" -- nil_value
    | ":" ExpSet -- nil_key
    | ":" -- nil_both
    | ExpPush

  ExpPush
    = ExpPush "->" ExpEval -- push
    | ExpEval

  ExpEval
    = ExpEval "$" ExpTrigger -- eval
    | ExpTrigger

  ExpTrigger
    = ExpTrigger "|" ExpNot -- trigger
    | ExpNot

  ExpNot
    = "!" ExpComp -- not
    | ExpComp

  ExpComp
    = ExpComp ("<=" | ">=" | "<" | ">" | "!" | "==" | "=") ExpSum -- comp
    | ExpSum

  ExpSum
    = ExpSum ("+" | "-") ExpProd -- sum
    | "-" ExpProd -- minus
    | ExpProd

  ExpProd
    = ExpProd ("*" | "/" | "%") ExpPow -- prod
    | ExpPow

  ExpPow
    = ExpPow "^" ExpDyn -- pow
    | ExpDyn

  ExpDyn
    = ("@@@" | "@@" | "@") ExpSep -- dyn
    | ExpSep

  ExpSep
    = ExpSep "." ExpComb -- sep
    | ExpComb

  ExpComb
    = ExpComb ExpLib -- comb
    | ExpLib

  ExpLib
    = "#" Atom -- lib
    | Atom

  Atom
    = List
    | value
    | "_" -- space
    | "~" -- identity
    | "?" -- context

  List
    = "[" Line ("," Line)* "]"
    | "(" Line ("," Line)* ")"
    | "{" Line ("," Line)* "}"

  Line
    = "'" Multi* "'" -- string
    | Exp -- exp
    | space* -- nil

  Multi
    = (char3 | escape)+ -- string
    | "<" Line ("," Line)* "/>" -- list

  value
    = "\\\\" any -- char
    | digit+ "." digit+ -- number
    | alnum+ -- value
    | "\\"" (char | escape)* "\\"" -- string
    | "'" (char2 | escape)* "'" -- string2
    | "\`" (~"\`" any)* "\`" -- comment

  char
    = ~("\\"" | "\\\\") any

  char2
    = ~("'" | "<" | ">" | "\\\\") any

  char3
    = ~("'" | "<" | "\\\\") any

  escape
    = "\\\\" any

}`;
