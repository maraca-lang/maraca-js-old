export interface Obj<T = any> {
  [key: string]: T;
}

export interface AST {
  type: string;
  nodes: (AST | null)[];
  info: any;
  start: number;
  end: number;
}

export type Source =
  | string
  | AST
  | [string | AST, Obj<string | AST | (() => Promise<string | AST>)>];

export type Data =
  | { type: 'nil'; value?: undefined }
  | { type: 'value'; value: string }
  | {
      type: 'list';
      value: {
        indices: Data[];
        values: Obj<{ key: Data; value: Data }>;
        other?: any;
      };
    };

export interface Config {
  '@': ((emit: (output: Data) => void) => (value?: Data) => void)[];
  '#': Obj<Data | ((emit: (output: Data) => void) => void | (() => void))>;
}
