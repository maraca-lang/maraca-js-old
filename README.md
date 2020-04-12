# Maraca JavaScript runtime

The JavaScript runtime for the Maraca language.

## Install

```
yarn add maraca
```

or

```
npm install maraca --save
```

## Maraca documentation

Full documentation for the Maraca language itself can be found at
https://maraca-lang.org/docs.

## Table of contents

- [API](#api)
- [Utilities](#utilities)
- [Full example](#full-example)

## API

The core runtime API parses and runs Maraca source code.

```ts
maraca(source, config?, output?);
```

The config parameter can be provided to setup the `@` and `#` Maraca language
features, and the output parameter can be provided to enable streaming.

```ts
import maraca from 'maraca';

const source = '[x: 1, y: 2, z: x? * y?]';

// snapshot
const data = maraca(source);

// stream
maraca(source, (data) => console.log(data));
```

### `source`

The Maraca source can be provided in any of the following formats:

```ts
  string
| ast
| [
    start: string | ast,
    modules: { [key]: string | ast | () => Promise<string | ast> },
  ]
```

If the object form is used, evaluation starts with the 'start' script, which can
then access the modules via the context block (i.e. `[key]?`).

### `config` (optional)

If provided, the config parameter sets up custom streams for the `@` and `#`
Maraca features.

```ts
{
  '@': (
    (emit: (output: data) => void) => ((value?: data) => void)
  )[],
  '#': {
    [key]: data | (emit: (output: data) => void) => void | (() => void)
  },
}
```

So the `@` key accepts an array (mapped to `@`, `@@`, `@@@`), and the `#`
accepts an object (mapped to `#[key]`).

For `@`, you are given an emit handler, and return a callback which is called
whenever the argument to the `@` call changes. When the stream is disposed, the
callback is called without an argument, which should be used to clean up any
side effects.

For `#`, you either directly provide a Maraca data value, or another map as for
`@`, except with only a dispose callback (since `#` calls have no argument).

### output (optional)

If provided, the runtime will run in stream mode, outputting the results to the
given callback.

## Data format

**Value**

```ts
{
  type: 'value',
  value: string,
  push: (value: data) => void,
}
```

**Block**

```ts
{
  type: 'block',
  value: { key: data, value: data }[],
  push: (value: data) => void,
}
```

## Utilities

### `parse: (source: string) => ast`

Convert a Maraca script to ast.

### `fromJS: (value: any) => data`

Convert a JavaScript value into Maraca data.

## Full example

```ts
import maraca, { fromJs } from 'maraca';

const source = ['module? + @1', { module: '#(#data)' }];

const config = {
  '@': [
    (emit) => {
      let count = 0;
      let interval;
      return (value) => {
        if (interval) clearInterval(interval);
        if (value) {
          const inc = parseFloat(value.value);
          if (typeof inc === 'number') {
            emit(fromJs(count++));
            interval = setInterval(() => emit(fromJs(count++)), inc * 1000);
          } else {
            emit(fromJs(null));
          }
        }
      };
    },
  ],
  '#': {
    data: fromJs({ a: 1, b: 2, c: 3 }),
  },
};

maraca(source, config, (data) => console.log(data));
```
