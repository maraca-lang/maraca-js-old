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
  | { type: 'nil'; value?: undefined; set?: any }
  | { type: 'value'; value: string; set?: any }
  | {
      type: 'list';
      value: {
        values: Obj<{ key: Data; value: Data }>;
        indices: number[];
        other?: any;
      };
      set?: any;
    };

export interface Config {
  '@': ((emit: (output: Data) => void) => (value?: Data) => void)[];
  '#': Obj<Data | ((emit: (output: Data) => void) => void | (() => void))>;
}
