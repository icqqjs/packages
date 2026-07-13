/**
 * 编译期占位类型：仓库本身不强制安装 @icqqjs/icqq。
 * 运行时通过 src/lib/icqq-resolve.ts 动态解析真实包；
 * 当本地装有真实依赖时，TypeScript 会优先使用 node_modules 中的声明。
 */
declare module "@icqqjs/icqq" {
  export type Platform = number;

  export interface MessageElem {
    type: string;
    data?: Record<string, unknown>;
    [key: string]: unknown;
  }

  export type ParsedGroupMessageId = {
    group_id: number;
    user_id: number;
    seq: number;
    rand: number;
    time: number;
    pktnum: number;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type Client = any;

  export function createClient(options: Record<string, unknown>): Client;
  export function parseGroupMessageId(msgid: string): ParsedGroupMessageId;
  export function genGroupMessageId(
    gid: number,
    uin: number,
    seq: number,
    rand: number,
    time: number,
    pktnum?: number,
  ): string;
  export function genDmMessageId(
    uin: number,
    seq: number,
    rand: number,
    time: number,
    flag?: number,
  ): string;
  export function parseDmMessageId(msgid: string): {
    user_id: number;
    seq: number;
    rand: number;
    time: number;
    flag: number;
  };
}