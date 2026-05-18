/**
 * 编译期占位类型：未安装 @icqqjs/icqq 时供 tsc 使用。
 * 本机已安装 @icqqjs/icqq 时，TypeScript 会优先解析 node_modules 中的真实类型。
 */
declare module "@icqqjs/icqq" {
  export type Platform = number;

  export interface MessageElem {
    type: string;
    data?: Record<string, unknown>;
    [key: string]: unknown;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type Client = any;

  export function createClient(options: Record<string, unknown>): Client;
}
