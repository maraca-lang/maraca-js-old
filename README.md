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
https://maraca-lang.org.

## Table of contents

- [API](#api)
- [Utilities](#utilities)
- [Data format](#data-format)
- [Example](#example)

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

The Maraca source can either be a string, or a nested set of objects, with each
key defining a module:

```ts
type Source =
  | string
  | {
      [key]: Source;
    };
```

If the object form is used, evaluation starts with the 'start' script, which can
then load the modules using the normal `?` syntax.

### `library` (optional)

If provided, the library parameter sets up custom streams that are then
available to your source code, again using the normal `?` syntax.

Custom streams can either be a constant `Data` value (see Data format below), or
a stream generator function, with the following API:

```ts
type Generator = (
  set: (data: Data) => void,
  get: (stream: Stream) => Data,
  create: (generator: Generator) => Stream,
) =>
  | void
  | (dispose?) => void;
```

So the library has the type:

```ts
type Library = {
  [key]: Data | Generator;
};
```

### output (optional)

If provided, the runtime will run in stream mode, outputting the results to the
given callback.

## Data format

The data output by Maraca has the following format:

```ts
type Data = ValueData | BlockData;

type ValueData = {
  type: 'value';
  value: string;
  push: (value: Data) => void;
};

type BlockData = {
  type: 'block';
  value: Block;
  push: (value: Data) => void;
};

type Block = {
  toPairs: () => { key: Data; value: Data }[];
};
```

The `push` method on each individual data value can be used to manually push
updates into your Maraca code.

## Utilities

### `parse: (source: string) => AST`

Convert a Maraca script to AST.

### `fromJS: (value: any) => Data`

Convert a JavaScript value into Maraca data.

## Example

```ts
import maraca, { fromJs } from 'maraca';

const source = ['module? + tick?', { module: '#data?' }];

const library = {
  data: fromJs({ a: 1, b: 2, c: 3 }),
  tick: (set) => {
    let count = 1;
    set(fromJs(count++));
    const interval = setInterval(() => set(fromJs(count++)), 1000);
    return (dispose) => dispose && clearInterval(interval);
  },
};

maraca(source, library, (data) => console.log(data));
```
