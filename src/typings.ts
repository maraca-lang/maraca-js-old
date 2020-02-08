import Box from './box';
import { Stream } from './streams';

export interface Obj<T = any> {
  [key: string]: T;
}

export interface AST {
  type: string;
  nodes?: (AST | null)[];
  info?: any;
  start: number;
  end: number;
}

export type Source =
  | string
  | AST
  | [string | AST, Obj<string | AST | (() => Promise<string | AST>)>];

export interface ValueData {
  type: 'value';
  value: string;
  push?: any;
}
export interface BoxData {
  type: 'box';
  value: Box;
  push?: any;
}
export interface StreamData {
  type: 'stream';
  value: Stream;
}
export type Data = ValueData | BoxData;
export type FullData = Data | StreamData;

export const isValue = (data: Data): data is ValueData => data.type === 'value';

export interface Config {
  '@'?: ((emit: (output: Data) => void) => (value?: Data) => void)[];
  '#'?: Obj<Data | ((emit: (output: Data) => void) => void | (() => void))>;
}
