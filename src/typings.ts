import Block from './block/block';
import { Stream } from './streams';

export interface Obj<T = any> {
  [key: string]: T;
}

export interface AST {
  __AST: true;
  type: string;
  nodes?: (AST | null)[];
  info?: any;
  start: number;
  end: number;
}

export type Factory = (
  set: (data: Data) => void,
  get: (stream: Stream) => Data,
  create: (build: Factory) => StreamData,
) => void | ((dispose?: boolean) => void);

export type Source = string | AST | Factory | Obj<Source>;

export interface ValueData {
  type: 'value';
  value: string;
  push?: any;
}
export interface BlockData {
  type: 'block';
  value: Block;
  push?: any;
}
export interface StreamData {
  type: 'stream';
  value: Stream;
}
export type Data = ValueData | BlockData;
export type FullData = Data | StreamData;

export const isValue = (data: Data): data is ValueData => data.type === 'value';
